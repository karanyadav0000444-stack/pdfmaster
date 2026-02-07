/**
 * UI Utilities - Toast, Progress, Thumbnails, Modals, Recent Files
 */

const UI = {
    pageState: [], // { originalIndex, rotation, element }
    
    /**
     * Show toast notification
     */
    showToast: (msg, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon;
        switch (type) {
            case 'success':
                icon = 'fa-circle-check';
                break;
            case 'error':
                icon = 'fa-triangle-exclamation';
                break;
            case 'warning':
                icon = 'fa-exclamation-circle';
                break;
            default:
                icon = 'fa-info-circle';
        }
        
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
        
        container.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * Update progress bar and text
     */
    updateProgress: (percent, text) => {
        const fill = document.getElementById('progress-fill');
        const num = document.getElementById('progress-percent');
        const txt = document.getElementById('loader-text');
        
        if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        if (num) num.innerText = `${Math.round(percent)}%`;
        if (text && txt) txt.innerText = text;
    },

    /**
     * Toggle loader overlay
     */
    toggleLoader: (show) => {
        const loader = document.getElementById('loader');
        if (show) {
            loader.classList.remove('hidden');
            UI.updateProgress(0, 'Starting...');
        } else {
            loader.classList.add('hidden');
        }
    },

    /**
     * Render PDF page thumbnails with drag-reorder support
     */
    renderThumbnails: async (file) => {
        const grid = document.getElementById('thumbnails-grid');
        grid.innerHTML = '';
        UI.pageState = [];

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            // Limit preview for performance
            const limit = Math.min(pdf.numPages, 50);
            
            for (let i = 1; i <= limit; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.2 }); 
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({ canvasContext: ctx, viewport }).promise;

                const wrapper = document.createElement('div');
                wrapper.className = 'page-thumb';
                wrapper.innerHTML = `
                    <div class="thumb-actions">
                        <button class="t-btn t-rot" onclick="app.rotatePage(${i-1}, this)" title="Rotate">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button class="t-btn t-del" onclick="app.deletePage(${i-1}, this)" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="page-number">Page ${i}</div>
                `;
                wrapper.prepend(canvas);
                grid.appendChild(wrapper);

                UI.pageState.push({ 
                    originalIndex: i - 1, 
                    rotation: 0, 
                    element: wrapper 
                });

                await PDFUtils.sleep(20);
            }

            if (pdf.numPages > 50) {
                UI.showToast(`Previewing first 50 of ${pdf.numPages} pages`, 'warning');
            }

        } catch (e) {
            console.error(e);
            UI.showToast('Could not generate previews. File might be encrypted or corrupted.', 'error');
        }
    },

    /**
     * Display file list for multi-file operations
     */
    updateFileList: (files) => {
        const grid = document.getElementById('thumbnails-grid');
        grid.innerHTML = ''; 
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        
        Array.from(files).forEach((f, index) => {
            const item = document.createElement('div');
            item.className = 'tool-card'; 
            item.style.padding = '1.5rem';
            item.style.cursor = 'default';
            
            const icon = f.type === 'application/pdf' ? 'fa-file-pdf' : 
                         PDFUtils.isValidImage(f) ? 'fa-file-image' : 'fa-file';
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <i class="fa-solid ${icon}" style="font-size: 2rem; color: var(--primary-glow);"></i>
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.name}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">${PDFUtils.formatFileSize(f.size)}</p>
                    </div>
                    <button class="t-btn t-del" onclick="app.removeFile(${index})" title="Remove" style="position: relative;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            grid.appendChild(item);
        });
    },

    /**
     * Show modal dialog
     */
    showModal: (title, content) => {
        const overlay = document.getElementById('modal-overlay');
        const body = document.getElementById('modal-body');
        
        body.innerHTML = `
            <h3>${title}</h3>
            ${content}
        `;
        
        overlay.classList.remove('hidden');
    },

    /**
     * Close modal
     */
    closeModal: () => {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.add('hidden');
    },

    /**
     * Show privacy policy modal
     */
    showPrivacyModal: () => {
        UI.showModal('Privacy Policy', `
            <p>UltiPDF is a 100% client-side application. This means:</p>
            <ul style="line-height: 2; margin: 1rem 0; padding-left: 1.5rem;">
                <li>All files are processed locally in your browser</li>
                <li>No files are uploaded to any server</li>
                <li>We do not collect, store, or have access to your documents</li>
                <li>Your data never leaves your device</li>
                <li>No tracking or analytics on file processing</li>
            </ul>
            <p>We may use cookies for basic website functionality and preferences (like theme selection). No personal data is collected.</p>
        `);
    },

    /**
     * Save recent file activity to localStorage
     */
    saveRecentFile: (toolName, filename, fileSize) => {
        try {
            const recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
            
            const newEntry = {
                id: Date.now(),
                tool: toolName,
                filename,
                fileSize: PDFUtils.formatFileSize(fileSize),
                timestamp: new Date().toISOString()
            };
            
            recent.unshift(newEntry);
            
            // Keep only last 10
            const trimmed = recent.slice(0, 10);
            
            localStorage.setItem('recentFiles', JSON.stringify(trimmed));
            UI.renderRecentFiles();
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    },

    /**
     * Render recent files list
     */
    renderRecentFiles: () => {
        try {
            const recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
            const container = document.getElementById('recent-files-list');
            
            if (!container) return;
            
            if (recent.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No recent activity yet</p>';
                return;
            }
            
            container.innerHTML = recent.map(item => {
                const date = new Date(item.timestamp);
                const timeAgo = UI.getTimeAgo(date);
                
                return `
                    <div class="recent-file-item">
                        <div class="recent-file-icon">
                            <i class="fa-solid fa-file-pdf"></i>
                        </div>
                        <div class="recent-file-info">
                            <h4>${item.filename}</h4>
                            <p>${item.tool} • ${item.fileSize} • ${timeAgo}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.warn('Could not render recent files:', e);
        }
    },

    /**
     * Get human-readable time ago
     */
    getTimeAgo: (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    },

    /**
     * Clear recent files
     */
    clearRecentFiles: () => {
        localStorage.removeItem('recentFiles');
        UI.renderRecentFiles();
        UI.showToast('Recent files cleared', 'success');
    },

    /**
     * Download multiple files as ZIP
     */
    downloadAsZip: async (files, zipName) => {
        const zip = new JSZip();
        
        files.forEach((fileData, index) => {
            zip.file(fileData.filename, fileData.blob);
        });
        
        UI.toggleLoader(true);
        UI.updateProgress(50, 'Creating ZIP archive...');
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        UI.toggleLoader(false);
        
        download(zipBlob, zipName, 'application/zip');
        UI.showToast('ZIP archive downloaded', 'success');
    },

    /**
     * Create download button with size info
     */
    createDownloadButton: (blob, filename, originalSize = null) => {
        const btn = document.createElement('button');
        btn.className = 'btn-primary-lg';
        
        const newSize = PDFUtils.formatFileSize(blob.size);
        let sizeInfo = '';
        
        if (originalSize && originalSize !== blob.size) {
            const reduction = ((1 - blob.size / originalSize) * 100).toFixed(1);
            sizeInfo = ` (${newSize}, ${reduction}% smaller)`;
        } else {
            sizeInfo = ` (${newSize})`;
        }
        
        btn.innerHTML = `<i class="fa-solid fa-download"></i> Download${sizeInfo}`;
        btn.onclick = () => {
            download(blob, filename, blob.type);
            UI.showToast('Download started', 'success');
        };
        
        return btn;
    },

    /**
     * Show input modal for user text input
     */
    showInputModal: (title, placeholder, callback) => {
        const content = `
            <input type="text" id="modal-input" placeholder="${placeholder}" 
                   style="width: 100%; padding: 12px; border: 1px solid var(--glass-border); 
                          border-radius: 8px; background: rgba(255,255,255,0.05); color: white; 
                          font-size: 1rem; margin: 1rem 0;">
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button class="btn-text" onclick="UI.closeModal()">Cancel</button>
                <button class="btn-primary-lg" onclick="
                    const val = document.getElementById('modal-input').value;
                    UI.closeModal();
                    (${callback})('${val}');
                ">Confirm</button>
            </div>
        `;
        
        UI.showModal(title, content);
        
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('modal-input');
            if (input) input.focus();
        }, 100);
    },

    /**
     * Show confirmation dialog
     */
    showConfirm: (title, message, onConfirm) => {
        const content = `
            <p style="margin: 1.5rem 0;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button class="btn-text" onclick="UI.closeModal()">Cancel</button>
                <button class="btn-primary-lg" onclick="UI.closeModal(); (${onConfirm})();">
                    Confirm
                </button>
            </div>
        `;
        
        UI.showModal(title, content);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}