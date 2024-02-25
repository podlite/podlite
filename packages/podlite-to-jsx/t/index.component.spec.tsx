import { TestPodlite as Podlite, Podlite as PodliteRaw } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

it('para content', () => {
  render(<Podlite>Hello!</Podlite>)

  expect(root.innerHTML).toMatchInlineSnapshot(`
       <p>
         Hello!
       </p>
    `)
})

it('table', () => {
  expect(
    render(
      <Podlite>
        {`
=begin pod
=para test
sdsdsd
=head1 Test
=begin table :caption('Super table!')
                        Secret
        Superhero       Identity          Superpower
        =============   ===============   ===================
        The Shoveller   Eddie Stevens     King Arthur's
                                          singing shovel

        Blue Raja       Geoffrey Smith    Master of cutlery

        Mr Furious      Roy Orson         Ticking time bomb
                                          of fury

        The I<Bowler>    Carol Pinnsler    Haunted bowling ball

=end table
=end pod
`}
      </Podlite>,
    ),
  ).toMatchInlineSnapshot(`
    <div id="id">
      <div id="id">
        <p>
          test
    sdsdsd
        </p>
      </div>
      <h1 id="id">
        Test
      </h1>
      <table id="id">
        <caption class="caption">
          Super table!
        </caption>
        <tbody>
          <tr id="id">
            <th id="id">
              Superhero
            </th>
            <th id="id">
              Secret Identity
            </th>
            <th id="id">
              Superpower
            </th>
          </tr>
          <tr id="id">
            <td id="id">
              The Shoveller
            </td>
            <td id="id">
              Eddie Stevens
            </td>
            <td id="id">
              King Arthur&#x27;s singing shovel
            </td>
          </tr>
          <tr id="id">
            <td id="id">
              Blue Raja
            </td>
            <td id="id">
              Geoffrey Smith
            </td>
            <td id="id">
              Master of cutlery
            </td>
          </tr>
          <tr id="id">
            <td id="id">
              Mr Furious
            </td>
            <td id="id">
              Roy Orson
            </td>
            <td id="id">
              Ticking time bomb of fury
            </td>
          </tr>
          <tr id="id">
            <td id="id">
              The
              <i>
                Bowler
              </i>
            </td>
            <td id="id">
              Carol Pinnsler
            </td>
            <td id="id">
              Haunted bowling ball
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `)
})

it('accepts =alias', () => {
  expect(
    render(
      <Podlite>
        {`
=begin pod
=alias TEST 4D Kingdoms
A<TEST>
=end pod
`}
      </Podlite>,
    ),
  ).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        4D Kingdoms
      </p>
    </div>
  `)
})

it('accepts =code', () => {
  render(
    <Podlite>
      {`
=code
  sdkljsalkdjlsd
  asdasdasdasdsad
=for code
  sdkljsalkdjlsd
  asdasdasdasdsad
=begin code
  sdkljsalkdjlsd
  asdasdasdasdsad
=end code
`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <code>
      <pre>
        sdkljsalkdjlsd
      asdasdasdasdsad
      </pre>
    </code>
    <code>
      <pre>
        sdkljsalkdjlsd
      asdasdasdasdsad
      </pre>
    </code>
    <code>
      <pre>
        sdkljsalkdjlsd
      asdasdasdasdsad
      </pre>
    </code>
  `)
})

it('accepts D<>', () => {
  render(
    <Podlite>
      {`
  =para
  A D<formatting code|formatting codes;formatters> provides a way
    to add inline mark-up to a D<piece> of text.
  `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        A
        <dfn>
          formatting code
        </dfn>
        provides a way
        to add inline mark-up to a
        <dfn>
          piece
        </dfn>
        of text.
      </p>
    </div>
  `)
})

it('accepts L<>', () => {
  render(
    <Podlite>
      {`
L<https://www.python.org/dev/peps/pep-0001/#what-is-a-pep>
L<Test|https://example.com>
  `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <p>
      <a href="https://www.python.org/dev/peps/pep-0001/#what-is-a-pep">
        https://www.python.org/dev/peps/pep-0001/#what-is-a-pep
      </a>
      <a href="https://example.com">
        Test
      </a>
    </p>
  `)
})

it('accepts =comment, Z<>, ', () => {
  render(
    <Podlite>
      {`
=begin pod
Z<comment>
=comment Test
=end pod
`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <p>
      </p>
    </div>
  `)
})

it('accepts E<>, R<>, V<>', () => {
  render(
    <Podlite>
      {`
=begin pod
The basic C<ln> command is: C<ln> B<R<source_file> R<target_file>>
E<0d171; 0o253; 0b10101011; 0xAB>
V<C<boo> B<bar> asd>
=end pod
`}
    </Podlite>,
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        The basic
        <code>
          ln
        </code>
        command is:
        <code>
          ln
        </code>
        <strong>
          <var>
            source_file
          </var>
          <var>
            target_file
          </var>
        </strong>
        ««««
    C&lt;boo&gt; B&lt;bar&gt; asd
      </p>
    </div>
  `)
})

it('accepts =output', () => {
  render(
    <Podlite>
      {`
=for code :allow(T)
T<output>
=begin output
Print? B<K<n>>
=end output
=for input
    Name: R<your surname>
`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <code>
      <pre>
        <samp>
          output
        </samp>
      </pre>
    </code>
    <pre>
      <samp>
        Print?
        <strong>
          <kbd>
            n
          </kbd>
        </strong>
      </samp>
    </pre>
    <pre>
      <kbd>
        Name:
        <var>
          your surname
        </var>
      </kbd>
    </pre>
  `)
})

it('accepts N<>', () => {
  render(
    <Podlite>
      {`
  =begin pod
  =para
  Use a C<for> loop instead.N<The Raku C<for> loop is far more
  powerful than its Perl 5 predecessor.> Preferably with an explicit
  iterator variable.
  
  =end pod
      `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div id="id">
        <p>
          Use a
          <code>
            for
          </code>
          loop instead.
          <sup id="fnref:1"
               class="footnote"
          >
            <a href="#fn:1">
              [1]
            </a>
          </sup>
          Preferably with an explicit
      iterator variable.
        </p>
      </div>
    </div>
    <p>
    </p>
    <div class="footnotes">
      <p>
        <sup id="fn:1"
             class="footnote"
        >
          <a href="#fnref:1">
            [1]
          </a>
        </sup>
        The Raku
        <code>
          for
        </code>
        loop is far more
      powerful than its Perl 5 predecessor.
      </p>
    </div>
  `)
})

it('accepts U<>, X<>, S<>', () => {
  render(
    <Podlite>
      {`
  =para
   An X<array|arrays> is an ordered list.
  U<a>. S<
   >
      `}
    </Podlite>,
  )

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        An array is an ordered list.
        <u>
          a
        </u>
        .
        <br>
           
      </p>
    </div>
  `)
})

it('accepts =Image base', () => {
  render(
    <Podlite>
      {`
  =begin pod
  =for Image :id<1> :caption<A picture of a cat> :link<https://example.com/cat.jpg>
  alternative https://www.example.org
  =end pod
`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="image_block"
           id="1"
      >
        <a href="https://example.com/cat.jpg">
          <img src="https://www.example.org"
               alt="alternative"
          >
        </a>
        <div class="caption">
          <p>
            A picture of a cat
          </p>
        </div>
      </div>
    </div>
  `)
})

it('accepts =Image empty caption', () => {
  render(
    <Podlite>
      {`
    =begin pod
    =for Image :id<1> :link<https://example.com/cat.jpg>
    alternative https://www.example.org
    =end pod
  `}
    </Podlite>,
  )
  // console.log(root.innerHTML);return;
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="image_block"
           id="1"
      >
        <a href="https://example.com/cat.jpg">
          <img src="https://www.example.org"
               alt="alternative"
          >
        </a>
      </div>
    </div>
    <p>
    </p>
  `)
})

it('accepts =Image with fullset of attributes', () => {
  render(
    <Podlite>
      {`
=begin pod
=for Image :alt<alternative> 
= :link<'https://www.example.org'>
= :src<'https://www.example.org'>
= :caption<'caption'>
= :id<'id'>
content ignored
=end pod
  `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="image_block"
           id="id"
      >
        <a href="https://www.example.org">
          <img src="https://www.example.org"
               alt="alternative"
          >
        </a>
        <div class="caption">
          <p>
            caption
          </p>
        </div>
      </div>
    </div>
    <p>
    </p>
  `)
})
it('accepts =TITLE', () => {
  render(
    <Podlite>
      {`
    =begin pod
    =TITLE test
    =para 1
=end pod`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div>
        <h1 class="TITLE">
          TITLE
        </h1>
        <p>
          test
        </p>
      </div>
      <div id="id">
        <p>
          1
        </p>
      </div>
    </div>
  `)
})

it('accepts =defn', () => {
  render(
    <Podlite>
      {`
=defn  MAD
Affected with a high degree of intellectual independence.
=defn  MEEKNESS
Uncommon patience in planning a revenge that is worth while.
=defn
MORAL
Conforming to a local and mutable standard of right.
Having the quality of general expediency.
    `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <dl>
      <dt>
        MAD
      </dt>
      <dd>
        Affected with a high degree of intellectual independence.
      </dd>
      <dt>
        MEEKNESS
      </dt>
      <dd>
        Uncommon patience in planning a revenge that is worth while.
      </dd>
      <dt>
        MORAL
      </dt>
      <dd>
        Conforming to a local and mutable standard of right.
    Having the quality of general expediency.
      </dd>
    </dl>
  `)
})

it('accepts =nested', () => {
  render(
    <Podlite>
      {`
=begin nested
We are all of us in the gutter,B<NL>
but some of us are looking at the stars!
    =begin nested
    -- Oscar Wilde
    =end nested
=end nested
`}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <blockquote>
      <p>
        We are all of us in the gutter,
        <strong>
          NL
        </strong>
        but some of us are looking at the stars!
      </p>
      <blockquote>
        <p>
          -- Oscar Wilde
        </p>
      </blockquote>
    </blockquote>
  `)
})

it('accepts =toc', () => {
  render(
    <Podlite>
      {`
    =begin pod
    =toc head1 item
    =for head1 :id<Test>
    head1
    =for item1 :id<item>
    item1
    =end pod
        `}
    </Podlite>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="toc">
        <ul class="toc-list listlevel1">
          <li class="toc-item">
            <a href="#Test">
              head1
            </a>
          </li>
          <ul class="toc-list listlevel2">
            <li class="toc-item">
              <a href="#item">
                item1
              </a>
            </li>
          </ul>
        </ul>
      </div>
      <h1 id="Test">
        head1
      </h1>
      <ul>
        <li id="item">
          <p>
            item1
          </p>
        </li>
      </ul>
    </div>
    <p>
    </p>
  `)
})

it('id for headers', () => {
  render(
    <PodliteRaw>{`
    =head1 Test 
    `}</PodliteRaw>,
  )
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <h1 id="Test">
      Test
    </h1>
  `)
})

it.skip('accepts =Mermaid', () => {
  render(
    <Podlite>
      {`
  =begin pod
  =Mermaid
graph LR
A --- B
B-->C[fa:fa-ban forbidden]
B-->D(fa:fa-spinner aaaaa);
  =end pod
      `}
    </Podlite>,
  )
  console.log(root.innerHTML)
  // expect(root.innerHTML).toMatchInlineSnapshot();
})

it.skip('accepts =alias', () => {
  render(
    <Podlite>
      {`
=begin pod
=alias PROGNAME    Earl Irradiatem Evermore
=alias VENDOR      4D Kingdoms
=alias TERMS_URLS  =item L<http://www.4dk.com/eie>
=                  =item L<http://www.4dk.co.uk/eie.io/>
=                  =item L<http://www.fordecay.ch/canttouchthis>
The use of A<PROGNAME> is subject to the terms and conditions
laid out by A<VENDOR>, as specified at:

A<TERMS_URLS>

=end pod
    `}
    </Podlite>,
  )
  console.log(root.innerHTML)
  // expect(root.innerHTML).toMatchInlineSnapshot();
})
