// Import rendered tldraw drawing
import drawing from './test-sketch.tldr'

// Add it to the DOM
const img = document.createElement('img')
img.src = drawing
document.body.append(img)
