/**
 * FileUpload Component
 *
 * Provides drag-and-drop and file picker UI for uploading attachments
 */

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { validateFile } from '../../types/attachment';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
}

export default function FileUpload({
  onFilesSelected,
  disabled = false,
  multiple = true,
  className = '',
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  /**
   * Handle file selection from input
   */
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle file drop
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  /**
   * Process and validate selected files
   */
  const processFiles = (files: File[]) => {
    setValidationErrors([]);

    if (files.length === 0) return;

    // If multiple is false, only take first file
    const filesToProcess = multiple ? files : [files[0]];

    // Validate all files
    const errors: string[] = [];
    const validFiles: File[] = [];

    filesToProcess.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    // Show validation errors
    if (errors.length > 0) {
      setValidationErrors(errors);
    }

    // Pass valid files to parent
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  /**
   * Open file picker
   */
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={className}>
      {/* Drag and Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {/* Upload Icon */}
        <div className="flex flex-col items-center gap-3">
          <svg
            className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {/* Instructions */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              or click to browse
            </p>
          </div>

          {/* File Type Info */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            <p>Supported: Images (10MB), Documents/Video/Audio (50MB)</p>
            <p className="mt-1">JPG, PNG, GIF, WebP, SVG, PDF, DOC, XLS, PPT, TXT, MP4, MP3, etc.</p>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.webm,.ogg,.mp3,.wav,.m4a"
        />
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Some files could not be uploaded:
              </p>
              <ul className="mt-1 list-disc list-inside text-xs text-red-700 dark:text-red-400">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
