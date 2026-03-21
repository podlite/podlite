import React, { useRef } from 'react'

type WindowWrapperProps = {
  children: React.ReactNode
  title?: string
}

const WindowWrapper = ({ children, title = '' }: WindowWrapperProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null)

  return (
    <div className="window" ref={wrapperRef}>
      <div className="titlebar">
        <div className="buttons"></div>
        {title && <span className="title">{title}</span>}
      </div>
      <div className="content">{children}</div>
      <style>{`
        .window {
          position: relative;
          margin: 2rem;
          border-radius: 6px;
          background: white;
          box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.2);
          border: 1px solid #ccc;
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
      `}</style>
    </div>
  )
}

export default WindowWrapper
