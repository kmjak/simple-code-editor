interface FileEntry {
  name: string;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  isDirectory: boolean;
  children?: FileEntry[];
};

export default FileEntry;