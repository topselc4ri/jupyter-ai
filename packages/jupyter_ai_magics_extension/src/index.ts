import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';

import { ICommandPalette } from '@jupyterlab/apputils';
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
// const plugin: JupyterFrontEndPlugin<void> = {
//   id: 'jupyter-ai-magics-extension:plugin',
//   description: 'A JupyterLab extension.',
//   autoStart: true,
//   requires: [INotebookTracker, ICommandPalette],
//   activate: (app: JupyterFrontEnd, tracker: INotebookTracker, palette: ICommandPalette) => {
//     const { commands } = app;




      
//     // 既存の実行コマンドをラップする新コマンド
//     const CMD = 'ai:run-cell-with-prefix';
      
//     commands.addCommand(CMD, {
//       label: 'Run Cell (with %%ai notebook prefix)',
//       execute: async () => {
//         const current = tracker.currentWidget;
//         if (!current) {
//           return;
//         }
//         const notebook = current.content;
//         const index = notebook.activeCellIndex;
//         const cellWidget = notebook.widgets[index];
//         const src = cellWidget.model.sharedModel.getSource();

//         // 先頭が %%ai でなければ通常実行
//         if (!src.trimStart().startsWith('%%ai')) {
//           await commands.execute('notebook:run-cell-and-select-next');
//           return;
//         }

//         // 0 〜 index までの prefix を JSON 化
//         const nbJson = notebookPrefixToJSON(current, index);
//         const jsonStr = JSON.stringify(nbJson);

//         // 1. 先にコンテキスト変数をカーネルへ渡す（silent 実行）
//         const session = current.sessionContext.session;
//         if (session?.kernel) {
//           await session.kernel.requestExecute({
//             code: "__AI_NOTEBOOK_PREFIX__ = " + JSON.stringify(jsonStr),
//             silent: true
//           }).done;
//         }

//         // 2. 本来のセル実行
//         await commands.execute('notebook:run-cell-and-select-next');
//       }
//     });

//     palette.addItem({
//       command: CMD,
//       category: 'AI',
//       rank: 100
//     });

//     // ショートカット上書き & ツールバーにボタン追加などは好みで
//     // 例: Shift+Enter をこのコマンドに差し替える、など
//     console.log('[jupyter-ai-magics-extension] activated');
//   }
// };

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'ai-notebook-prefix',
  autoStart: true,
  requires: [INotebookTracker, ICommandPalette],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker, palette: ICommandPalette) => {
    const { commands } = app;

    // 元の execute を保持
    const originalExecute = commands.execute.bind(commands);

    const CMD = 'ai:run-cell-with-prefix';

    // 共通ロジック
    const runCellWithPrefix = async (args?: any): Promise<any> => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      const notebook = current.content;
      const index = notebook.activeCellIndex;
      const cellWidget = notebook.widgets[index];
      const src = cellWidget.model.sharedModel.getSource();

      // 先頭が %%ai でなければそのまま本来の run-cell を呼ぶ
      if (!src.trimStart().startsWith('%%ai')) {
        return originalExecute('notebook:run-cell-and-select-next', args);
      }

      // prefix JSON を作成
      const nbJson = notebookPrefixToJSON(current, index);
      const jsonStr = JSON.stringify(nbJson);
      const session = current.sessionContext.session;

      // 1. prefix を Python カーネルへ渡す
      if (session?.kernel) {
        await session.kernel.requestExecute(
          {
            code: "__AI_NOTEBOOK_PREFIX__ = " + JSON.stringify(jsonStr),
            silent: true
          }
        ).done;
      }

      // 2. 本来のセル実行
      return originalExecute('notebook:run-cell-and-select-next', args);
    };

    // ③ コマンドとして登録
    commands.addCommand(CMD, {
      label: 'Run Cell (with %%ai notebook prefix)',
      execute: runCellWithPrefix
    });

    palette.addItem({
      command: CMD,
      category: 'AI',
      rank: 100
    });

    // ④ notebook:run-cell-and-select-next をフックして、共通ロジックを呼ぶ
    commands.execute = (id: string, args?: any): Promise<any> => {
      if (id === 'notebook:run-cell-and-select-next') {
        // ここで自分のコマンドを呼ぶ
        return originalExecute(CMD, args);
      }
      // それ以外のコマンドはそのまま
      return originalExecute(id, args);
    };

    console.log('[jupyter-ai-magics-extension] activated (hooking run-cell)');
  }
};

export default plugin;
