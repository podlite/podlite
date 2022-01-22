// this file contains the dictionary ot the messages used in the podlite editor

const dict = [
    {
        "displayText": "head1",
        "text": `=head1 `
    },
    {
        "displayText": "head2",
        "text": `=head2 `
    },
    
    {
        "displayText": "head3",
        "text": `=head3 `
    },
    {
        "displayText": "item1 *",
        "text": `=item1 `
    }, 
    {
    "displayText": "item1 1.)",
    "text": `=item1 # `
},
{
    "displayText": "item (1., 2.) 🏷",
    "text": `=item1 # item 
    =item2 # item level 2
    =item2 # item level 2
=item1 # item
    =item2 # item
    =item2 # item level 2
`},
{
    "displayText": "item (*, *) 🏷",
    "text": `=item1  item 
    =item2 item level 2
    =item2 item level 2
=item1  item
    =item2 item
    =item3  item level 2
`},
{
    "displayText": "Image 🏷",
    "text": `=Image https://github.com/zag/podlite-desktop/blob/master/dist-assets/linux-icon/256x256.png?raw=true
`,
},
{
    "displayText": "table simple 🏷",
    "text":`=for table
    mouse    | mice
    horse    | horses
    elephant | elephants
`
},
{
    "displayText": "table 2x 🏷",
    "text": `=begin table :caption('Caption of table')
Constants           1
Variables           10
Subroutines         33
Everything else     57
=end table
`},
{
    "displayText": "table 3x 🏷",
    "text": `=for table :caption('Caption of table')
    Animal | Legs |    Eats
    =======================
    Zebra  +   4  + Cookies
    Human  +   2  +   Pizza
    Shark  +   0  +    Fish
`
},
{
    "displayText": "Diagram Sequence 🏷",
    "text": `=Diagram
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

`
},
{
    "displayText": "Diagram simple 🏷",
    "text": `=begin Diagram 
    graph LR
            A-->B
            B-->C
            C-->A
            D-->C
=end Diagram
`
},
{
    "displayText": "Diagram flowchart 🏷",
    "text": `=Diagram
    graph LR
        A[Square Rect] -- Link text --> B((Circle))
        A --> C(Round Rect)
        B --> D{Rhombus}
        C --> D

`
},
{
    "displayText": "Diagram class 🏷",
    "text": `=Diagram
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

`
},
{
    "displayText": "code block with formatting 🏷",
    "text": `=begin code :allow<IBZ> 

=end code
`
},
{
    "displayText": "Toc head1, head2, head3",
    "text": `=Toc head1, head2, head2
`},
{
    "displayText": "Toc (with :title) 🏷",
    "text": `=for Toc :title('Table of content')
head1, head2, head2 

`
},
{
    "displayText": "Toc ( Images, Diagrams )  + tables 🏷",
    "text": `=for Toc :title('List of media')
Image, Diagram
=for Toc :title('List of tables')
table

`
},

]
export default dict;
