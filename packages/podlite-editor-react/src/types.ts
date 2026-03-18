type FoldRange = {
  readonly from: number
  readonly to: number
}

export type EditorSessionState = {
  readonly cursorOffset?: number
  readonly scrollTop?: number
  readonly foldedRanges?: ReadonlyArray<FoldRange>
  readonly isPreviewMode?: boolean
  readonly isHalfPreviewMode?: boolean
}
