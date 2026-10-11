// At this point the leading content element is still an unparsed text node;
// formatting codes are built from its value further down the pipeline. Cut the
// marker out of that value and leave the node in place: replacing the array
// with a plain string ends the chain early and drops every L<>, C<> and B< >
// written on the same line. Only a paragraph has its content cut; code keeps it.
export const stripMarker = (para, re: RegExp) => {
  if (typeof para.text === 'string') para.text = para.text.replace(re, '')
  if (para.type !== 'para') return
  if (!Array.isArray(para.content)) {
    if (typeof para.text === 'string') para.content = [para.text]
    return
  }
  const first = para.content[0]
  if (typeof first === 'string') {
    para.content[0] = first.replace(re, '')
  } else if (first && typeof first.value === 'string') {
    first.value = first.value.replace(re, '')
  }
}
