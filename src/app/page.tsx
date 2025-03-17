"use client";

import { useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { FolderIcon, FileIcon, SaveIcon } from "lucide-react";
import FileEntry from "@/types/FileEntry";
import FileTree from "./components/TreeFile";

const suggestions = [
  "function",
  "const",
  "let",
  "var",
  "return",
  "console.log",
  "useEffect",
  "useState",
  "import",
  "export",
  "if",
  "else",
  "for",
  "while",
  "async",
  "await",
];

export default function FileEditor(): ReactNode {
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<FileSystemFileHandle | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState({ lineIndex: 0, column: 0, absPos: 0 });
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [currentWord, setCurrentWord] = useState({ word: "", startPos: 0, endPos: 0 });
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (filteredSuggestions.length > 0 && !justCompleted) {
      setShowSuggestions(true);
      setSelectedIndex(0);
      updateSuggestionPosition();
    } else {
      setShowSuggestions(false);
    }
  }, [filteredSuggestions, justCompleted]);

  useEffect(() => {
    updateLineNumbers();
    syncScroll();
  }, [editedContent]);

  useEffect(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      const textareaStyle = window.getComputedStyle(textareaRef.current);
      const fontSize = textareaStyle.fontSize;
      const lineHeight = textareaStyle.lineHeight;
      
      lineNumbersRef.current.style.fontSize = fontSize;
      lineNumbersRef.current.style.lineHeight = lineHeight;
    }
  }, []);

  const handleOpenDirectory = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!('showDirectoryPicker' in window)) {
        throw new Error("このブラウザは File System Access API をサポートしていません。");
      }

      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      const tree: FileEntry[] = await getAllFiles(dirHandle);
      setFileTree(tree);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name !== 'AbortError') {
          console.error("ディレクトリの読み込みエラー:", error);
          setError(error.message || "ディレクトリの読み込み中にエラーが発生しました。");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAllFiles = async (dirHandle: FileSystemDirectoryHandle): Promise<FileEntry[]> => {
    const entries: FileEntry[] = [];

    try {
      for await (const [name, entry] of dirHandle.entries()) {
        if (entry.kind === "file") {
          entries.push({ name, handle: entry as FileSystemFileHandle, isDirectory: false });
        } else if (entry.kind === "directory") {
          const children = await getAllFiles(entry as FileSystemDirectoryHandle);
          entries.push({ name, handle: entry as FileSystemDirectoryHandle, isDirectory: true, children });
        }
      }

      return entries.sort((a, b): number => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      if (error instanceof Error) {
        console.error("エントリーの読み込みエラー:", error);
        throw new Error("ディレクトリの読み込み中にエラーが発生しました。");
      } else {
        console.error("不明なエラーが発生しました:", error);
        throw new Error("ディレクトリの読み込み中に不明なエラーが発生しました。");
      }
    }
  };

  const handleOpenFile = useCallback(async (fileHandle: FileSystemFileHandle): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (currentFile && fileContent !== editedContent) {
        const confirmSave: boolean = confirm("変更を保存しますか？");
        if (confirmSave) {
          await handleSaveFile();
        }
      }

      const file: File = await fileHandle.getFile();
      const text: string = await file.text();
      setCurrentFile(fileHandle);
      setFileContent(text);
      setEditedContent(text);
    } catch (error) {
      if (error instanceof Error) {
        console.error("ファイルの読み込みエラー:", error.message);
        setError(error.message || "ファイルの読み込み中にエラーが発生しました。");
      } else {
        console.error("不明なエラーが発生しました:", error);
        setError("ファイルの読み込み中に不明なエラーが発生しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, fileContent, editedContent]);

  const handleSaveFile = useCallback(async () => {
    if (!currentFile) return;

    try {
      setIsLoading(true);
      setError(null);

      const writable: FileSystemWritableFileStream = await currentFile.createWritable();
      await writable.write(editedContent);
      await writable.close();

      setFileContent(editedContent);

      const toast: HTMLDivElement = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg';
      toast.textContent = 'ファイルが保存されました';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    } catch (error) {
      if (error instanceof Error) {
        console.error("保存エラー:", error);
        setError(error.message || "ファイルの保存中にエラーが発生しました。");
      } else {
        console.error("不明なエラーが発生しました:", error);
        setError("ファイルの保存中に不明なエラーが発生しました。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentFile, editedContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEditedContent(value);

    const cursorPos = e.target.selectionStart;
    updateCursorPosition(e.target, cursorPos);

    setJustCompleted(false);

    findCurrentWord(value, cursorPos);
  };

  const findCurrentWord = (value: string, cursorPos: number) => {
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    const beforeParts = textBeforeCursor.split(/\s/);
    const currentWordStart = beforeParts[beforeParts.length - 1];

    const afterMatch = textAfterCursor.match(/^\S*/);
    const currentWordEnd = afterMatch ? afterMatch[0] : "";

    const fullWord = currentWordStart + currentWordEnd;

    const startPos = cursorPos - currentWordStart.length;
    const endPos = cursorPos + currentWordEnd.length;

    setCurrentWord({
      word: fullWord,
      startPos,
      endPos
    });

    if (currentWordStart.length > 0 && !justCompleted) {
      const matches = suggestions.filter((s) =>
        s.startsWith(currentWordStart) && s !== currentWordStart
      );
      setFilteredSuggestions(matches);
    } else {
      setFilteredSuggestions([]);
    }
  };

  const updateCursorPosition = (textarea: HTMLTextAreaElement, cursorPos: number) => {
    const value = textarea.value;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const lineIndex = lines.length - 1;
    const column = lines[lineIndex].length;

    setCursorPosition({
      lineIndex,
      column,
      absPos: cursorPos
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (showSuggestions) {
          e.preventDefault();
          insertSuggestion(filteredSuggestions[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
      e.preventDefault();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentFile && fileContent !== editedContent) {
        handleSaveFile();
      }
    }

    setTimeout(() => {
      if (textareaRef.current) {
        const cursorPos = textareaRef.current.selectionStart;
        updateCursorPosition(textareaRef.current, cursorPos);
        findCurrentWord(textareaRef.current.value, cursorPos);
      }
    }, 0);
  };

  const insertSuggestion = (suggestion: string) => {
    if (!textareaRef.current) return;
    const textBeforeCursor = editedContent.substring(0, currentWord.startPos);
    const textAfterCursor = editedContent.substring(currentWord.endPos);

    const newText = textBeforeCursor + suggestion + textAfterCursor;
    setEditedContent(newText);
    setFilteredSuggestions([]);
    setShowSuggestions(false);
    setJustCompleted(true);

    const newCursorPos = textBeforeCursor.length + suggestion.length;

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
        updateCursorPosition(textareaRef.current, newCursorPos);
      }
    }, 0);
  };

  const updateSuggestionPosition = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 18;

    const rect = textarea.getBoundingClientRect();
    const scrollTop = textarea.scrollTop;

    const lineNumberWidth = lineNumbersRef.current ? lineNumbersRef.current.offsetWidth : 0;

    const charWidth = 8;

    const textBeforeWord = editedContent.substring(0, currentWord.startPos);
    const linesBeforeWord = textBeforeWord.split('\n');
    const charsInCurrentLine = linesBeforeWord[linesBeforeWord.length - 1].length;

    setPosition({
      left: rect.left + lineNumberWidth + (charsInCurrentLine * charWidth),
      top: rect.top + ((cursorPosition.lineIndex + 1) * lineHeight) - scrollTop
    });
  };

  const updateLineNumbers = () => {
    if (!lineNumbersRef.current || !textareaRef.current) return;

    const lines = editedContent.split('\n');
    const lineCount = Math.max(1, lines.length);

    if (lineNumbersRef.current) {
      lineNumbersRef.current.innerHTML = '';
      for (let i = 0; i < lineCount; i++) {
        const lineNumberElement = document.createElement('div');
        lineNumberElement.className = 'line-number';
        lineNumberElement.textContent = `${i + 1}`;
        lineNumbersRef.current.appendChild(lineNumberElement);
      }
    }
  };

  const syncScroll = () => {
    if (!lineNumbersRef.current || !textareaRef.current) return;
    lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
  };

  const handleScroll = () => {
    syncScroll();
    if (showSuggestions) {
      updateSuggestionPosition();
    }
  };

  const handleFocus = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      const textareaStyle = window.getComputedStyle(textareaRef.current);
      lineNumbersRef.current.style.paddingTop = textareaStyle.paddingTop;
      lineNumbersRef.current.style.paddingBottom = textareaStyle.paddingBottom;
      lineNumbersRef.current.style.lineHeight = textareaStyle.lineHeight;
    }
  };

  const hasChanges = currentFile && fileContent !== editedContent;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-gray-800 text-white p-4 overflow-auto">
        <h1 className="text-xl font-bold mb-4">Editor</h1>

        <button
          onClick={handleOpenDirectory}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center mb-4"
          disabled={isLoading}
        >
          <FolderIcon className="mr-2" size={16} />
          {isLoading ? "読み込み中..." : "フォルダを開く"}
        </button>

        <div className="mt-2">
          {fileTree.length > 0 ? (
            <FileTree entries={fileTree} onFileClick={handleOpenFile} />
          ) : (
            <p className="text-gray-400 text-sm">
              フォルダを開いてファイルを表示
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentFile && (
          <div className="bg-gray-700 text-white px-4 py-2 flex justify-between items-center">
            <div className="flex items-center">
              <FileIcon size={16} className="mr-2" />
              <span>{currentFile.name}</span>
              {hasChanges && <span className="ml-2 text-xs">•</span>}
            </div>
            <button
              onClick={handleSaveFile}
              className={`px-3 py-1 rounded flex items-center ${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'}`}
              disabled={!hasChanges || isLoading}
            >
              <SaveIcon size={16} className="mr-1" />
              保存
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-2">
            <p>{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {currentFile ? (
            <div className="flex h-full">
              <div
                ref={lineNumbersRef}
                className="line-numbers bg-gray-100 text-gray-500 text-right pr-2 overflow-hidden"
                style={{
                  width: '3rem',
                  fontFamily: 'monospace',
                  userSelect: 'none',
                  borderRight: '1px solid #d1d5db',
                  paddingTop: '8px',
                  paddingBottom: '8px'
                }}
              >
                <div className="line-number">1</div>
              </div>

              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                onFocus={handleFocus}
                className="flex-1 p-2 font-mono text-sm bg-white border-none resize-none focus:outline-none overflow-auto"
                disabled={isLoading}
                spellCheck={false}
              />

              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul
                  className="absolute bg-white border border-gray-300 rounded-md max-h-40 overflow-y-auto shadow-lg z-10"
                  style={{
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    minWidth: "150px",
                  }}
                >
                  {filteredSuggestions.map((s, index) => (
                    <li
                      key={s}
                      onClick={() => insertSuggestion(s)}
                      className={`px-3 py-2 cursor-pointer hover:bg-blue-200 ${
                        index === selectedIndex ? "bg-blue-300" : ""
                      }`}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500">
              <p>ファイルを選択してください</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .line-numbers {
          display: flex;
          flex-direction: column;
        }
        .line-number {
          height: 1.5em;
        }
        textarea, .line-numbers {
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}