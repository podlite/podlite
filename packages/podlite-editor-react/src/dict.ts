// this file contains the dictionary ot the messages used in the podlite editor
interface Dict {
  displayText: string
  text: string
  lang?: 'pod6' | 'md'
}
const dict: Dict[] = [
  {
    displayText: 'head1',
    text: `=head1 `,
  },
  {
    displayText: 'head2',
    text: `=head2 `,
  },

  {
    displayText: 'head3',
    text: `=head3 `,
  },
  {
    displayText: 'item1 *',
    text: `=item1 `,
  },
  {
    displayText: 'item1 1.)',
    text: `=item1 # `,
  },
  {
    displayText: 'item (1., 2.) 🏷',
    text: `=item1 # item 
    =item2 # item level 2
    =item2 # item level 2
=item1 # item
    =item2 # item
    =item2 # item level 2
`,
  },
  {
    displayText: 'item (*, *) 🏷',
    text: `=item1  item 
    =item2 item level 2
    =item2 item level 2
=item1  item
    =item2 item
    =item3  item level 2
`,
  },
  {
    displayText: 'picture 🏷',
    text: `=picture https://github.com/zag/podlite-desktop/blob/master/dist-assets/linux-icon/256x256.png?raw=true
`,
  },
  {
    displayText: 'table simple 🏷',
    text: `=for table
    mouse    | mice
    horse    | horses
    elephant | elephants
`,
  },
  {
    displayText: 'table 2x 🏷',
    text: `=begin table :caption('Caption of table')
Constants           1
Variables           10
Subroutines         33
Everything else     57
=end table
`,
  },
  {
    displayText: 'table 3x 🏷',
    text: `=for table :caption('Caption of table')
    Animal | Legs |    Eats
    =======================
    Zebra  +   4  + Cookies
    Human  +   2  +   Pizza
    Shark  +   0  +    Fish
`,
  },
  {
    displayText: 'Mermaid diagram simple 🏷',
    text: `=begin Mermaid  :caption('Caption of diagram')
    graph LR
            A-->B
            B-->C
            C-->A
            D-->C
=end Mermaid
`,
  },
  {
    displayText: 'Mermaid diagram Sequence 🏷',
    text: `=for Mermaid :caption('Caption of diagram')
    sequenceDiagram
        autonumber
        Student->>Admin: Can I enrol this semester?
        loop enrolmentCheck
            Admin->>Admin: Check previous results
        end
        Note right of Admin: Exam results may <br> be delayed
        Admin-->>Student: Enrolment success
        Admin->>Professor: Assign student to tutor
        Professor-->>Admin: Student is assigned

`,
  },
  {
    displayText: 'Mermaid flowchart 🏷',
    text: `=for Mermaid :caption('Caption of diagram')
    graph LR
        A[Square Rect] -- Link text --> B((Circle))
        A --> C(Round Rect)
        B --> D{Rhombus}
        C --> D

`,
  },
  {
    displayText: 'Mermaid class 🏷',
    text: `=for Mermaid :caption('Caption of diagram')
    classDiagram
       Person <|-- Student
       Person <|-- Professor
       Person : +String name
       Person : +String phoneNumber
       Person : +String emailAddress
       Person: +purchaseParkingPass()
       Address "1" <-- "0..1" Person:lives at
       class Student{
          +int studentNumber
          +int averageMark
          +isEligibleToEnrol()
          +getSeminarsTaken()
        }
        class Professor{
          +int salary
        }
        class Address{
          +String street
          +String city
          +String state
          +int postalCode
          +String country
          -validate()
          +outputAsLabel()  
    }

`,
  },
  {
    displayText: 'code block with formatting 🏷',
    text: `=begin code :allow<I B Z> 
  {}
=end code
`,
  },
  {
    displayText: 'toc head1, head2, head3',
    text: `=toc head1, head2, head3
`,
  },
  {
    displayText: 'toc (with :title) 🏷',
    text: `=for toc :title('Table of contents')
head1, head2, head3 

`,
  },
  {
    displayText: 'toc ( picture, Mermaid )  + tables 🏷',
    text: `=for toc :title('List of media')
picture, Mermaid
=for toc :title('List of tables')
table

`,
  },

  {
    displayText: 'markdown',
    text: `=begin markdown

  {}

=end markdown
`,
  },
  {
    displayText: 'formula with caption 🏷',
    text: `=for formula :caption('The Cauchy-Schwarz Inequality')
   \\left( \\sum_{k=1}^n a_k b_k \\right)^2 \\leq \\left( \\sum_{k=1}^n a_k^2 \\right) \\left( \\sum_{k=1}^n b_k^2 \\right)
{}
`,
  },

  // markdown mode

  {
    displayText: 'head1',
    text: `# `,
    lang: 'md',
  },
  {
    displayText: 'head2',
    text: `## `,
    lang: 'md',
  },

  {
    displayText: 'head3',
    text: `### `,
    lang: 'md',
  },
  {
    displayText: 'item1 *',
    text: `* `,
    lang: 'md',
  },
  {
    displayText: 'item1 1.)',
    text: `1. `,
    lang: 'md',
  },
  {
    displayText: 'picture 🏷',
    text: `![Podlite](https://github.com/zag/podlite-desktop/blob/master/dist-assets/linux-icon/256x256.png?raw=true "Podlite logo")

`,
    lang: 'md',
  },

  {
    displayText: 'Table',
    text: `| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |

`,
    lang: 'md',
  },
  {
    displayText: 'Mermaid simple 🏷',
    text: `\`\`\`mermaid 
graph LR
        A-->B
        B-->C
        C-->A
        D-->C
\`\`\``,
    lang: 'md',
  },
  {
    displayText: 'formula 🏷',
    text: `
$$
\\left( \\sum_{k=1}^n a_k b_k \\right)^2 \\leq \\left( \\sum_{k=1}^n a_k^2 \\right) \\left( \\sum_{k=1}^n b_k^2 \\right)
$$
{}
`,
    lang: 'md',
  },
]
export default dict
