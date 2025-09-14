import React from 'react'
import Editor from '../src/Editor'
import { WindowWrapper } from '../src/'
// export default App;
const text1 = `=head2 Diagrams

=begin Mermaid :caption('Diagram with caption')
graph LR
        A-->B
        B-->C
        C-->A
        D-->C
=end Mermaid

=begin comment
This is a commented text. 
=end comment

=head2 Lists 

Options B<are>:

=item1  Animal
=item2     Vertebrate
=item2     Invertebrate

=item1  Phase
=item2     Solid
=item2     Liquid
=item2     Gas
=item2     I<Chocolate>

`

export const TestEditor = ({ id, children, item, renderNode, isShowRoot }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isPreview, setIsPreview] = React.useState(false)
  const [isFullPreview, setFullPreview] = React.useState(false)
  const [textChanged, setTextChanged] = React.useState(false)
  const [text, updateText] = React.useState(text1 + text1 + text1 + text1 + text1)
  const wrapFunctionNoLines = (node: Node, children) => children
  const convertSourcetoComponent = (text: string) => {
    console.log('rendering preview')
    return { result: <h1>This is preview1111</h1> }
  }
  const [line, setLine] = React.useState(20)
  return (
    <div>
      <div
        onClick={() => {
          setLine(Math.max(1, line - 1))
        }}
      >
        {' '}
        +{' '}
      </div>
      {line}
      <div onClick={() => setLine(line + 1)}> - </div>
      <WindowWrapper title="Code block">
        <Editor
          height="500px"
          previewWidth={'100%'}
          value={text1 + text1 + text1}
          enablePreview={true}
          startLinePreview={line}
        />
      </WindowWrapper>

      <WindowWrapper title="Editor with Preview">
        <Editor height="500px" value={text1} enablePreview={true} />
      </WindowWrapper>

      <Editor
        onChange={(content: string) => {
          // updateText(content)
          setTextChanged(true)
        }}
        height={'500px'}
        value={text}
        enablePreview={true}
        previewWidth={'50%'}
        basicSetup={{ defaultKeymap: false }}
        readOnly={false}
        isFullscreen={false}
        // makePreviewComponent={convertSourcetoComponent}
      />

      <div onClick={() => setIsFullscreen(!isFullscreen)}>
        {isFullscreen ? 'on' : 'off'}: Changed {textChanged ? '*' : null}
      </div>
      <div onClick={() => setIsPreview(!isPreview)}>preview {isPreview ? 'on' : 'off'}: </div>
      <div onClick={() => setFullPreview(!isFullPreview)}>full Preview {isFullPreview ? 'on' : 'off'}: </div>
      <Editor
        onChange={(content: string) => {
          // updateText(content)
          setTextChanged(true)
        }}
        height={'500px'}
        value={text}
        enablePreview={isPreview}
        previewWidth={isPreview ? (isFullPreview ? '100%' : '50%') : '0'}
        basicSetup={{ defaultKeymap: false }}
        readOnly={false}
        isFullscreen={isFullscreen}
      />
    </div>
  )
}

export default function App() {
  return (
    <div>
      <h1>App</h1>
    </div>
  )
}
