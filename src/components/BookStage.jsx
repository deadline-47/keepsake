import { forwardRef, useMemo } from 'react'
import HTMLFlipBook from 'react-pageflip'

const Page = forwardRef(function Page({ image, pageNumber, isCover }, ref) {
  return (
    <div
      ref={ref}
      className={`relative h-full w-full overflow-hidden bg-parchment ${
        isCover ? 'rounded-r-md rounded-l-sm' : ''
      }`}
    >
      {/*
        object-contain (not object-cover) is what actually fixes the
        landscape crop: the outer container is already sized to match the
        PDF's real aspect ratio (see computeFitDimensions below), so
        "contain" shows the whole page. If a handful of pages in a mixed
        document differ slightly in ratio, contain letterboxes instead of
        cutting content off — cover would keep clipping the sides.
      */}
      <img
        src={image}
        alt={`Page ${pageNumber}`}
        className="h-full w-full select-none object-contain"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(0,0,0,0.12)]" />
    </div>
  )
})

/**
 * Fits a box with the given aspect ratio (width / height) inside the
 * available (maxWidth, maxHeight), preserving that ratio exactly.
 * This is the piece that was missing before: the old logic held height
 * fixed and only ever shrank width, so a wide landscape PDF ended up in a
 * container that was still tall and narrow — which is what caused the
 * sides to appear cut off.
 */
function computeFitDimensions(aspectRatio, maxWidth, maxHeight) {
  const safeRatio = aspectRatio > 0 ? aspectRatio : 0.72

  let width = maxHeight * safeRatio
  let height = maxHeight

  if (width > maxWidth) {
    width = maxWidth
    height = maxWidth / safeRatio
  }

  return {
    width: Math.max(Math.round(width), 1),
    height: Math.max(Math.round(height), 1),
  }
}

/**
 * Renders the interactive 3D flipbook. Sizing is driven by the natural
 * aspect ratio of the source PDF pages so portrait and landscape documents
 * both fit their full page with nothing cropped.
 */
const BookStage = forwardRef(function BookStage(
  { pages, aspectRatio, onFlip, size = { width: 460, height: 640 } },
  ref
) {
  const dimensions = useMemo(
    () => computeFitDimensions(aspectRatio, size.width, size.height),
    [aspectRatio, size]
  )

  return (
    <div
      className="[perspective:2400px]"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <HTMLFlipBook
        // Remounting when the fitted box changes meaningfully guarantees
        // StPageFlip re-initializes with the correct page geometry instead
        // of stretching the previous (wrong) geometry — this matters most
        // right after a PDF finishes rendering and the true aspect ratio
        // becomes known. Rounding to the nearest 20px avoids remounting on
        // every pixel of a window resize.
        key={`${Math.round(dimensions.width / 20)}x${Math.round(dimensions.height / 20)}`}
        ref={ref}
        width={dimensions.width}
        height={dimensions.height}
        size="fixed"
        minWidth={dimensions.width}
        maxWidth={dimensions.width}
        minHeight={dimensions.height}
        maxHeight={dimensions.height}
        drawShadow
        flippingTime={650}
        usePortrait
        startPage={0}
        startZIndex={10}
        maxShadowOpacity={0.5}
        showCover
        mobileScrollSupport={false}
        clickEventForward
        useMouseEvents
        swipeDistance={20}
        showPageCorners
        disableFlipByClick={false}
        className="rounded-r-md rounded-l-sm shadow-book"
        style={{}}
        onFlip={onFlip}
      >
        {pages.map((image, index) => (
          <Page
            key={index}
            image={image}
            pageNumber={index + 1}
            isCover={index === 0 || index === pages.length - 1}
          />
        ))}
      </HTMLFlipBook>
    </div>
  )
})

export default BookStage
