/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Analysis, AnalyzerOptions, PackageUrlResolver} from 'polymer-analyzer';
import {AnalysisCache} from 'polymer-analyzer/lib/core/analysis-cache';
import {AnalysisContext} from 'polymer-analyzer/lib/core/analysis-context';
import {Analyzer} from 'polymer-analyzer/lib/core/analyzer';
import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';
import {FileChangeType, FileEvent, TextDocuments} from 'vscode-languageserver';

import AnalyzerLSPConverter from './converter';
import FileSynchronizer from './file-synchronizer';
import {AutoDisposable, EventStream} from './util';

/**
 * Exposes an Analyzer that is always in sync with the client's state,
 * and that can give the versions of open files when a given Analysis was
 * generated.
 */
export default class AnalyzerSynchronizer extends AutoDisposable {
  public readonly analyzer: LsAnalyzer;
  /**
   * An event stream that fires every time files have changed such that
   * re-analyzing may give different results.
   *
   * We don't expose the list of files changed here because the file the
   * user is interested in may depend on one of the files changed. The
   * Analyzer is smart about this, so we'll return cached results almost
   * instantly if nothing has actually changed.
   */
  public readonly analysisChanges: EventStream<void>;
  constructor(
      private readonly documents: TextDocuments,
      fileSynchronizer: FileSynchronizer,
      private readonly converter: AnalyzerLSPConverter) {
    super();

    const {fire, stream} = EventStream.create<void>();
    this.analysisChanges = stream;
    const analysisVersionMap = new WeakMap<Analysis, Map<string, number>>();
    this.analyzer = new LsAnalyzer(this.documents, analysisVersionMap, {
      urlLoader: fileSynchronizer.urlLoader,
      urlResolver: new PackageUrlResolver(),
    });

    this.disposables.push(
        fileSynchronizer.fileChanges.listen((filesChangeEvents) => {
          this.handleFilesChanged(filesChangeEvents, fire);
        }));
  }

  private async handleFilesChanged(
      fileChangeEvents: FileEvent[], onComplete: (value: void) => void) {
    const paths = fileChangeEvents.map(
        change => this.converter.getWorkspacePathToFile(change));
    if (paths.length === 0) {
      return;  // no new information in this notification
    }
    const deletions =
        fileChangeEvents
            .filter((change) => change.type === FileChangeType.Deleted)
            .map((change) => this.converter.getWorkspacePathToFile(change));
    if (deletions.length > 0) {
      // When a directory is deleted we may not be told about individual
      // files, we'll have to determine the tracked files ourselves.
      // This involves mucking around in private implementation details of
      // the analyzer, so we wrap this in a try/catch.
      // Analyzer issue for a supported API:
      // https://github.com/Polymer/polymer-analyzer/issues/761
      try {
        const context: AnalysisContext =
            await this.analyzer['_analysisComplete'];
        const cache: AnalysisCache = context['_cache'];
        const cachedPaths = new Set<ResolvedUrl>([
          ...cache.failedDocuments.keys(),
          ...cache.parsedDocumentPromises['_keyToResultMap'].keys()
        ]);
        for (const deletedPath of deletions) {
          const deletedDir = deletedPath + '/';
          for (const cachedPath of cachedPaths) {
            if (cachedPath.startsWith(deletedDir)) {
              paths.push(cachedPath);
            }
          }
        }
      } catch {
        // Mucking about in analyzer internals on a best effort basis here.
      }
    }
    // Clear the files from any caches and recalculate warnings as needed.
    const filesChangedPromise = this.analyzer.filesChanged(paths);
    // After we've called filesChanged, future calls to analyze will get
    // the updated results, we don't need to wait on the filesChangedPromise
    // to actually resolve.
    onComplete(undefined);
    await filesChangedPromise;
  }
}

/**
 * An extension of the analyzer that's aware of the LSP versions of
 * in-memory files at the time an analysis is generated.
 */
export class LsAnalyzer extends Analyzer {
  constructor(
      private documents: TextDocuments,
      private analysisVersionMap:
          WeakMap<Analysis, ReadonlyMap<string, number>>,
      options: AnalyzerOptions) {
    super(options);
  }

  analyze(files: string[]): Promise<Analysis> {
    return this.annotateWithVersionMap(super.analyze(files));
  }

  analyzePackage(): Promise<Analysis> {
    return this.annotateWithVersionMap(super.analyzePackage());
  }

  private async annotateWithVersionMap(promise: Promise<Analysis>) {
    const versionMap = new Map<string, number>();
    for (const document of this.documents.all()) {
      versionMap.set(document.uri, document.version);
    }
    const analysis = await promise;
    this.analysisVersionMap.set(analysis, versionMap);
    return analysis;
  }

  /**
   * Gives a map from URI to version number for all open files at the moment
   * that the given Analysis was generated.
   *
   * This is useful for getting versions right when applying edits.
   */
  getVersionsAtAnalysis(analysis: Analysis): ReadonlyMap<string, number> {
    return this.analysisVersionMap.get(analysis)!;
  }
}
