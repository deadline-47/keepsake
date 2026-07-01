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
      <img
        src={image}
        alt={`Page ${pageNumber}`}
        className="h-full w-full select-none object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(0,0,0,0.12)]" />
    </div>
  )
})

/**
 * Renders the interactive 3D flipbook. Sizing is driven by the natural
 * aspect ratio of the source PDF pages so portrait and landscape documents
 * both look correct.
 */
const BookStage = forwardRef(function BookStage(
  { pages, aspectRatio, onFlip, size = { width: 460, height: 640 } },
  ref
) {
  const dimensions = useMemo(() => {
    const targetHeight = size.height
    const targetWidth = Math.round(targetHeight * aspectRatio)
    return {
      width: Math.min(targetWidth, size.width),
      height: targetHeight,
    }
  }, [aspectRatio, size])

  return (
    <div className="[perspective:2400px]">
      <HTMLFlipBook
        ref={ref}
        width={dimensions.width}
        height={dimensions.height}
        size="stretch"
        minWidth={220}
        maxWidth={900}
        minHeight={300}
        maxHeight={1200}
        drawShadow
        flippingTime={650}
        usePortrait
        startPage={0}
        startZIndex={10}
        autoSize
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
