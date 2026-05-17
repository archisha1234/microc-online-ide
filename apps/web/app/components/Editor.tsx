'use client';

import { useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';

const SAMPLE = `int add(int a, int b) {
  return a + b;
}

int main() {
  int x = 10;
  int y = 20;
  int z = add(x, y);
  return z;
}`;

export default function Editor() {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const transpilerRef = useRef<any>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    async function loadWasm() {
      try {
        const wasm = await import('microc-transpiler/microc_transpiler.js');
        await wasm.default();
        transpilerRef.current = wasm;
      } catch (e) {
        console.error('WASM load error:', e);
      }
    }
    loadWasm();
  }, []);

  async function handleEditorMount(editor: any) {
    editorRef.current = editor;

    const Y = await import('yjs');
    const { WebsocketProvider } = await import('y-websocket');
    const { MonacoBinding } = await import('y-monaco');

    const doc = new Y.Doc();
    const text = doc.getText('monaco');

    const wsProvider = new WebsocketProvider(
      'ws://localhost:1234',
      'microc-room',
      doc
    );

    wsProvider.on('status', (event: any) => {
      setConnected(event.status === 'connected');
    });

    wsProvider.on('sync', (isSynced: boolean) => {
        setTimeout(() => {
        if (isSynced && text.length === 0) {
            text.insert(0, SAMPLE);
        }
        }, 100);
    });

    new MonacoBinding(
      text,
      editor.getModel(),
      new Set([editor]),
      wsProvider.awareness
    );
  }

  async function handleTranspile() {
    if (!transpilerRef.current || !editorRef.current) return;
    setLoading(true);
    try {
      const code = editorRef.current.getValue();
      const result = transpilerRef.current.transpile(code);
      setOutput(result);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-blue-400">MicroC IDE</h1>
          <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-700' : 'bg-red-700'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={handleTranspile}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          {loading ? 'Transpiling...' : 'Transpile → C'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-gray-700">
          <p className="px-4 py-2 text-xs text-gray-400 bg-gray-800">MicroC Input</p>
          <MonacoEditor
            height="100%"
            language="c"
            theme="vs-dark"
            defaultValue={SAMPLE}
            onMount={handleEditorMount}
            options={{ fontSize: 14, minimap: { enabled: false } }}
          />
        </div>

        <div className="flex-1">
          <p className="px-4 py-2 text-xs text-gray-400 bg-gray-800">ANSI-C Output</p>
          <MonacoEditor
            height="100%"
            language="c"
            theme="vs-dark"
            value={output}
            options={{ fontSize: 14, minimap: { enabled: false }, readOnly: true }}
          />
        </div>
      </div>
    </div>
  );
}