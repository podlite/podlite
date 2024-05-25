# @podlite/formula

Example of using formulas in text (`F<>`) and as `=formula` blocks:

```
=for formula :caption('The Cauchy-Schwarz Inequality')
   \left( \sum_{k=1}^n a_k b_k \right)^2 \leq \left( \sum_{k=1}^n a_k^2 \right) \left( \sum_{k=1}^n b_k^2 \right)



This is an inline  example: F< y = \sqrt{3x-1}+(1+x)^2 >
```

Formulas can be input in Markdown mode.

```
=begin markdown

  * this is a example of `formula` inside markdown: $y = \sqrt{3x-1}+(1+x)^2$

  and block:

  $$
  \left( \sum_{k=1}^n a_k b_k \right)^2 \leq \left( \sum_{k=1}^n a_k^2 \right) \left( \sum_{k=1}^n b_k^2 \right)
  $$

or

$$
\operatorname{ker} f=\{g\in G:f(g)=e_{H}\}{\mbox{.}}
$$

=end markdown
```

[example at pod6.in](http://pod6.in/#p=%3Dfor+formula+%3Acaption%28%27The+Cauchy-Schwarz+Inequality%27%29%0A+++%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+a_k+b_k+%5Cright%29%5E2+%5Cleq+%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+a_k%5E2+%5Cright%29+%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+b_k%5E2+%5Cright%29%0A%0A%0A%0AThis+is+an+inline++example%3A+F%3C+y+%3D+%5Csqrt%7B3x-1%7D%2B%281%2Bx%29%5E2+%3E%0A%0A%3Dbegin+markdown%0A%0A++*+this+is+a+example+of+%60formula%60+inside+markdown%3A+%24y+%3D+%5Csqrt%7B3x-1%7D%2B%281%2Bx%29%5E2%24%0A++%0A++and+block%3A+%0A++%0A++%24%24%0A++%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+a_k+b_k+%5Cright%29%5E2+%5Cleq+%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+a_k%5E2+%5Cright%29+%5Cleft%28+%5Csum_%7Bk%3D1%7D%5En+b_k%5E2+%5Cright%29%0A++%24%24%0A++%0A++%0A%0A%3Dend+markdown%0A%0A)

<div align="center">
<table border=0><tr><td valign=top><div align="center">

##### specification

</div>

- [Source](https://github.com/podlite/podlite-specs)
- [in HTML](https://podlite.org/specification)
- [Discussions](https://github.com/podlite/podlite-specs/discussions)
- [Implementation](https://github.com/podlite/podlite)

</td><td valign=top><div align="center">

##### publishing system

</div>

- [Podlite-web](https://github.com/podlite/podlite-web)
- [How-to article](https://zahatski.com/2022/8/23/1/start-you-own-blog-site-with-podlite-for-web)
- [Issues](https://github.com/podlite/podlite-specs/issues)

</td><td valign=top><div align="center">
  
##### desktop viewer/editor

</div>

- [Podlite-desktop](https://github.com/podlite/podlite-desktop)
- [Releases](https://github.com/podlite/podlite-desktop/releases)
- [Issues](https://github.com/podlite/podlite-desktop/issues)

</td><td valign=top><div align="center">

##### online resurces

 </div>

- [podlite.org](https://podlite.org)
- [pod6.in](https://pod6.in/)
- [github.com/podlite](https://github.com/podlite/)

</td></tr></table>
</div>

## AUTHOR

Copyright (c) 2024 Aliaksandr Zahatski

## License

Released under a MIT License.
