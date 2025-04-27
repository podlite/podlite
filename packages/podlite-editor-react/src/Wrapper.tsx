import React, { useRef } from 'react'

const WindowWrapper = ({ children, title = '' }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const handleCopy = async () => {
    if (!wrapperRef.current) return
    const html = wrapperRef.current.outerHTML

    try {
      const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
              <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                  ${html}
                </div>
              </foreignObject>
            </svg>
          `.trim()

      const dataURL = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
      await navigator.clipboard.writeText(dataURL)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const copyElementToClipboard = async () => {
    if (!wrapperRef.current) return

    try {
      //   setIsLoading(true);

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const element = wrapperRef.current
      const rect = element.getBoundingClientRect()

      canvas.width = rect.width * 2
      canvas.height = rect.height * 2

      const svgData = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
              <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml">
                  ${element.outerHTML}
                </div>
              </foreignObject>
            </svg>
          `
      console.log('1')
      const base64Data = btoa(unescape(encodeURIComponent(svgData)))
      //   const base64Data = btoa(encodeURIComponent(svgData));
      const dataUrl = `data:image/svg+xml;base64,${base64Data}`
      console.log(dataUrl)
      const image = new Image()
      image.crossOrigin = 'anonymous'
      console.log('2')
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = e => {
          console.error('Image load error:', e)
          reject(e)
        }
        image.src = dataUrl
      })
      console.log('3')
      if (context) {
        context.scale(2, 2)
        context.drawImage(image, 0, 0)
      }
      console.log('4')
      const imageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))

      if (imageBlob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })])
      }
    } catch (err) {
      console.error('Screenshot failed:', err)
    } finally {
      //   setIsLoading(false);
    }
  }

  return (
    <div className="window" ref={wrapperRef}>
      <div className="titlebar">
        <div className="buttons">
          {/* <button className="close" />
          <button className="minimize"  />
          <button className="maximize"  /> */}
        </div>
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
