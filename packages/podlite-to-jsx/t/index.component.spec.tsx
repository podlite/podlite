import Podlite from "../src/index";
import React from "react";
import ReactDOM from "react-dom";

const root = document.body.appendChild(document.createElement("div"));

function render(jsx) {
  return ReactDOM.render(jsx, root);
}

afterEach(() => ReactDOM.unmountComponentAtNode(root));

it("para content", () => {
  render(<Podlite>Hello!</Podlite>);

  expect(root.innerHTML).toMatchInlineSnapshot(`
       <p>
         Hello!
       </p>
    `);
});

it("table", () => {
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
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
      <div>
        <p>
          test
    sdsdsd
        </p>
      </div>
      <h1>
        Test
      </h1>
      <table>
        <caption>
          Super table!
        </caption>
        <tbody>
          <tr>
            <th>
              Superhero
            </th>
            <th>
              Secret Identity
            </th>
            <th>
              Superpower
            </th>
          </tr>
          <tr>
            <td>
              The Shoveller
            </td>
            <td>
              Eddie Stevens
            </td>
            <td>
              King Arthur's singing shovel
            </td>
          </tr>
          <tr>
            <td>
              Blue Raja
            </td>
            <td>
              Geoffrey Smith
            </td>
            <td>
              Master of cutlery
            </td>
          </tr>
          <tr>
            <td>
              Mr Furious
            </td>
            <td>
              Roy Orson
            </td>
            <td>
              Ticking time bomb of fury
            </td>
          </tr>
          <tr>
            <td>
              The
              <i>
                Bowler
              </i>
            </td>
            <td>
              Carol Pinnsler
            </td>
            <td>
              Haunted bowling ball
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `);
});

it("accepts =alias", () => {
  render(
    <Podlite>
      {`
=begin pod
=alias TEST 4D Kingdoms
A<TEST>
=end pod
`}
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
      <p>
        4D Kingdoms
      </p>
    </div>
  `);
});

it("accepts =code", () => {
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
    </Podlite>
  );
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
  `);
});

it("accepts D<>", () => {
  render(
    <Podlite>
      {`
  =para
  A D<formatting code|formatting codes;formatters> provides a way
    to add inline mark-up to a D<piece> of text.
  `}
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
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
  `);
});

it("accepts L<>", () => {
  render(
    <Podlite>
      {`
L<https://www.python.org/dev/peps/pep-0001/#what-is-a-pep>
L<Test|https://example.com>
  `}
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <p>
      <a href="https://www.python.org/dev/peps/pep-0001/#what-is-a-pep">
        https://www.python.org/dev/peps/pep-0001/#what-is-a-pep
      </a>
      <a href="https://example.com">
        Test
      </a>
    </p>
  `);
});

it("accepts =comment, Z<>, ", () => {
  render(
    <Podlite>
      {`
=begin pod
Z<comment>
=comment Test
=end pod
`}
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
      <p>
      </p>
    </div>
  `);
});

it("accepts E<>, R<>, V<>", () => {
  render(
    <Podlite>
      {`
=begin pod
The basic C<ln> command is: C<ln> B<R<source_file> R<target_file>>
E<0d171; 0o253; 0b10101011; 0xAB>
V<C<boo> B<bar> asd>
=end pod
`}
    </Podlite>
  );

  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
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
  `);
});

it("accepts =output", () => {
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
    </Podlite>
  );
  // console.log(root.innerHTML);
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
  `);
});

it("accepts N<>", () => {
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
    </Podlite>
  );
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div>
      <div>
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
  `);
});


it("accepts U<>, X<>, S<>", () => {
    render(
      <Podlite>
        {`
  =para
   An X<array|arrays> is an ordered list.
  U<a>. S<
   >
      `}
      </Podlite>
    );
    console.log(root.innerHTML);
    // expect(root.innerHTML).toMatchInlineSnapshot();
  });




it.skip("accepts =alias", () => {
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
    </Podlite>
  );
  console.log(root.innerHTML);
  // expect(root.innerHTML).toMatchInlineSnapshot();
});