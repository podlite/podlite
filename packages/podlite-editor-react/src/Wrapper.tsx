import React, { useRef, useState } from 'react'

type WindowWrapperProps = {
  children: React.ReactNode
  title?: string
  enableCopyPng?: boolean
}

const WindowWrapper = ({ children, title = '', enableCopyPng = false }: WindowWrapperProps) => {
  const windowRef = useRef<HTMLDivElement>(null)
  const copyBtnRef = useRef<HTMLButtonElement>(null)
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyPng = async () => {
    if (!windowRef.current) return
    try {
      if (copyBtnRef.current) {
        copyBtnRef.current.style.display = 'none'
      }
      const domtoimage = (await import('dom-to-image-more')).default
      const blob = await domtoimage.toBlob(windowRef.current, { quality: 1.0 })
      if (copyBtnRef.current) {
        copyBtnRef.current.style.display = ''
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      if (copyBtnRef.current) {
        copyBtnRef.current.style.display = ''
      }
      console.error('Copy PNG failed:', err)
    }
  }

  return (
    <div className="window-capture" ref={windowRef}>
      <div className="window">
        <div className="titlebar">
          <div className="buttons"></div>
          {title && <span className="title">{title}</span>}
          <div className="titlebar-spacer"></div>
          {enableCopyPng && (
            <button ref={copyBtnRef} className="copy-png-btn" onClick={handleCopyPng} title="Copy as PNG">
              {isCopied ? '\u2713' : '\u2398'}
            </button>
          )}
        </div>
        <div className="content">{children}</div>
      </div>
      <style>{`
        .window-capture {
          padding: 1.5rem;
          display: inline-block;
          margin: 0.5rem;
          max-width: 100%;
          box-sizing: border-box;
        }

        .window {
          position: relative;
          margin: 2rem;
          border-radius: 6px;
          background: white;
          box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.2);
          border: 1px solid #ccc;
          max-width: 100%;
          box-sizing: border-box;
        }

        .titlebar {
          background: linear-gradient(to bottom, #f7f7f7, #e6e6e6);
          padding: 8px 12px;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          border-bottom: 1px solid #ccc;
          display: flex;
          align-items: center;
        }

        .titlebar-spacer {
          flex: 1;
        }

        .buttons {
          display: flex;
          gap: 6px;
          margin-right: 8px;
        }

        .buttons button {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: none;
          padding: 0;
          cursor: pointer;
        }

        .close {
          background: #ff5f56;
          border: 1px solid #e0443e;
        }

        .minimize {
          background: #ffbd2e;
          border: 1px solid #dea123;
        }

        .maximize {
          background: #27c93f;
          border: 1px solid #1aab29;
        }

        .title {
          color: #4d4d4d;
          font-size: 13px;
          margin-left: 4px;
        }

        .content {
          padding: 16px;
        }

        .copy-png-btn {
          background: none;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 2px 8px;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          line-height: 1;
          transition: background 0.15s, color 0.15s;
        }

        .copy-png-btn:hover {
          background: #e0e0e0;
          color: #333;
        }
      `}</style>
    </div>
  )
}

export default WindowWrapper
