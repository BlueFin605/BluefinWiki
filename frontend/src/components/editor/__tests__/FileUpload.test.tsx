/**
 * Tests for FileUpload Component (Task 7.3)
 * 
 * Tests drag-and-drop, file picker, validation, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '../FileUpload';

describe('FileUpload Component', () => {
  let mockOnFilesSelected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnFilesSelected = vi.fn();
  });

  describe('Basic Rendering', () => {
    it('should render drag-and-drop zone', () => {
      render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    });

    it('should render file type information', () => {
      render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      expect(screen.getByText(/Supported: Images \(10MB\), Documents\/Video\/Audio \(50MB\)/i)).toBeInTheDocument();
    });

    it('should have hidden file input', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass('hidden');
    });

    it('should set multiple attribute on file input by default', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveProperty('multiple', true);
    });

    it('should not set multiple attribute when multiple is false', () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} multiple={false} />
      );

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toHaveProperty('multiple', false);
    });
  });

  describe('File Picker (Click Upload)', () => {
    it('should open file picker when clicking the drop zone', async () => {
      const user = userEvent.setup();
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByText(/drag and drop files here/i).closest('div');
      if (dropZone) {
        await user.click(dropZone);
      }

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should process selected files from file picker', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('should handle multiple file selection', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'image.png', { type: 'image/png' }),
      ];

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(files);
      });
    });

    it('should only select first file when multiple is false', async () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} multiple={false} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        new File(['content1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'doc2.pdf', { type: 'application/pdf' }),
      ];

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([files[0]]);
      });
    });

    it('should reset input value after file selection', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(fileInput.value).toBe('');
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should show dragging state on drag over', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      
      fireEvent.dragOver(dropZone);

      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
      expect(dropZone).toHaveClass('border-blue-500');
    });

    it('should remove dragging state on drag leave', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      
      fireEvent.dragOver(dropZone);
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();

      fireEvent.dragLeave(dropZone);
      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });

    it('should handle file drop', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [file],
        },
      });

      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
      });
    });

    it('should handle multiple files drop', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.png', { type: 'image/png' }),
      ];

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files },
      });

      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(files);
      });
    });

    it('should prevent default on drag over', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      const dragOverEvent = new Event('dragover', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');

      fireEvent(dropZone, dragOverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on drop', () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      const dropEvent = new Event('drop', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(dropEvent, 'preventDefault');
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [] },
      });

      fireEvent(dropZone, dropEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    it('should accept valid image files under 10MB', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      // 5MB image
      const file = new File([new ArrayBuffer(5 * 1024 * 1024)], 'image.png', {
        type: 'image/png',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
      });

      // Should not show error
      expect(screen.queryByText(/could not be uploaded/i)).not.toBeInTheDocument();
    });

    it('should accept valid document files under 50MB', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      // 30MB PDF
      const file = new File([new ArrayBuffer(30 * 1024 * 1024)], 'document.pdf', {
        type: 'application/pdf',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
      });

      expect(screen.queryByText(/could not be uploaded/i)).not.toBeInTheDocument();
    });

    it('should reject image files over 10MB', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      // 15MB image (over limit)
      const file = new File([new ArrayBuffer(15 * 1024 * 1024)], 'large-image.png', {
        type: 'image/png',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
        expect(screen.getByText(/large-image.png.*too large/i)).toBeInTheDocument();
      });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('should reject document files over 50MB', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      // 60MB PDF (over limit)
      const file = new File([new ArrayBuffer(60 * 1024 * 1024)], 'large-doc.pdf', {
        type: 'application/pdf',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
        expect(screen.getByText(/large-doc.pdf.*too large/i)).toBeInTheDocument();
      });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('should reject unsupported file types', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'script.exe', { type: 'application/x-msdownload' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
        expect(screen.getByText(/script.exe.*not supported/i)).toBeInTheDocument();
      });

      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('should show multiple validation errors for mixed valid/invalid files', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        new File(['valid'], 'valid.pdf', { type: 'application/pdf' }),
        new File([new ArrayBuffer(15 * 1024 * 1024)], 'too-big.png', { type: 'image/png' }),
        new File(['invalid'], 'bad.exe', { type: 'application/x-msdownload' }),
      ];

      Object.defineProperty(fileInput, 'files', {
        value: files,
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
        expect(screen.getByText(/too-big.png.*too large/i)).toBeInTheDocument();
        expect(screen.getByText(/bad.exe.*not supported/i)).toBeInTheDocument();
      });

      // Should only pass valid files
      expect(mockOnFilesSelected).toHaveBeenCalledWith([files[0]]);
    });
  });

  describe('Disabled State', () => {
    it('should disable file input when disabled', () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} disabled={true} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeDisabled();
    });

    it('should apply opacity styling when disabled', () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} disabled={true} />
      );

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      expect(dropZone).toHaveClass('opacity-50');
    });

    it('should not show dragging state when disabled', () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} disabled={true} />
      );

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      
      fireEvent.dragOver(dropZone);

      // Should still show original text, not "drop files here"
      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
      expect(dropZone).not.toHaveClass('border-blue-500');
    });

    it('should not process dropped files when disabled', async () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} disabled={true} />
      );

      const dropZone = container.querySelector('.border-dashed') as HTMLElement;
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file] },
      });

      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(mockOnFilesSelected).not.toHaveBeenCalled();
      });
    });

    it('should not open file picker when clicking while disabled', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} disabled={true} />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      const dropZone = screen.getByText(/drag and drop files here/i).closest('div');
      if (dropZone) {
        await user.click(dropZone);
      }

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <FileUpload onFilesSelected={mockOnFilesSelected} className="custom-class" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('Error Display', () => {
    it('should display error icon when validation fails', async () => {
      const { container } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'bad.exe', { type: 'application/x-msdownload' });

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
      });

      // Check for SVG error icon - should be present in the error display
      const svgIcons = container.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThan(0);
    });

    it('should clear previous errors when new valid files are selected', async () => {
      const { container, rerender } = render(<FileUpload onFilesSelected={mockOnFilesSelected} />);

      let fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First, upload invalid file
      const invalidFile = new File(['content'], 'bad.exe', {
        type: 'application/x-msdownload',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/could not be uploaded/i)).toBeInTheDocument();
      });

      // Re-render to get a fresh file input
      rerender(<FileUpload onFilesSelected={mockOnFilesSelected} />);
      fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

      // Now upload valid file
      const validFile = new File(['content'], 'good.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        configurable: true,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByText(/could not be uploaded/i)).not.toBeInTheDocument();
      });
    });
  });
});
