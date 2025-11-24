import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';

import * as nbformat from '@jupyterlab/nbformat';

function notebookPrefixToJSON(panel: NotebookPanel, uptoIndex: number): nbformat.INotebookContent {
  // const model = panel.model!;
  // const cells: nbformat.ICell[] = [];

  // for (let i = 0; i <= uptoIndex && i < model.cells.length; i++) {
  //   const cellModel = model.cells.get(i)!;
  //   cells.push(cellModel.toJSON() as nbformat.ICell);
  // }

  // return {
  //   cells,
  //   metadata: model.metadata.toJSON(),
  //   nbformat: 4,
  //   nbformat_minor: 5
  // };

  // Notebook 全体の JSON を取る（null の可能性がある扱いなので union 型にしておく）
  const full = panel.context.model.toJSON() as nbformat.INotebookContent | null;

  // 念のため null の場合のフォールバック
  if (!full) {
    return {
      cells: [],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5
    };
  }

  const max = Math.min(uptoIndex + 1, full.cells.length);

  // オブジェクトを書き換えず、コピーを返す方が型的にも安全
  return {
    ...full,
    cells: full.cells.slice(0, max)
  };
}

/**
 * Initialization data for the jupyter-ai-magics-extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-ai-magics-extension:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    const { commands } = app;

    // 既存の実行コマンドをラップする新コマンド
    const CMD = 'ai:run-cell-with-prefix';
      
    commands.addCommand(CMD, {
      label: 'Run Cell (with %%ai notebook prefix)',
      execute: async () => {
        const current = tracker.currentWidget;
        if (!current) {
          return;
        }
        const notebook = current.content;
        const index = notebook.activeCellIndex;
        const cellWidget = notebook.widgets[index];
        const src = cellWidget.model.sharedModel.getSource();

        // 先頭が %%ai でなければ通常実行
        if (!src.trimStart().startsWith('%%ai')) {
          await commands.execute('notebook:run-cell-and-select-next');
          return;
        }

        // 0 〜 index までの prefix を JSON 化
        const nbJson = notebookPrefixToJSON(current, index);
        const jsonStr = JSON.stringify(nbJson);

        // 1. 先にコンテキスト変数をカーネルへ渡す（silent 実行）
        const session = current.sessionContext.session;
        if (session?.kernel) {
          await session.kernel.requestExecute({
            code: "__AI_NOTEBOOK_PREFIX__ = " + JSON.stringify(jsonStr),
            silent: true
          }).done;
        }

        // 2. 本来のセル実行
        await commands.execute('notebook:run-cell-and-select-next');
      }
    });

    // ショートカット上書き & ツールバーにボタン追加などは好みで
    // 例: Shift+Enter をこのコマンドに差し替える、など
    console.log('[jupyter-ai-magics-extension] activated');
  }
};

export default plugin;
