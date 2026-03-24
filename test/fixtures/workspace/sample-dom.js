// Import image from Photos.app album path via Aphex
import image from '~aphex/pets/tiny/portrait'

// Add it to the DOM
const img = document.createElement('img')
img.src = image
document.body.append(img)
