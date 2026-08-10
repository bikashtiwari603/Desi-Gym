/**
 * DESI GYM - Captions System
 * Manages Gen-Z / Desi gym humor captions with Rozha One (Hindi) and Birthstone (English) typography formatting.
 */

export const CAPTIONS = [
  "भाई आज leg day है",
  "एक और set भाई",
  "cardio कल से",
  "PR आज ही लगेगा",
  "बस एक और rep",
  "protein पी लिया?",
  "आज तो भारी पड़ेगा",
  "currently pretending this is a warm-up.",
  "protein consumed. responsibilities ignored.",
  "bro said one last set"
];

let currentIndex = 0;

/**
 * Formats a caption string into HTML with split spans:
 * - Hindi text wrapped in <span class="font-hi"> (Rozha One)
 * - English text wrapped in <span class="font-en"> (Birthstone)
 * @param {string} text
 * @returns {string} HTML string
 */
export function formatCaptionHTML(text) {
  const tokens = text.match(/([A-Za-z0-9.,'?!-]+|[^\x00-\x7F]+|\s+)/g) || [text];
  
  return tokens.map(token => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    if (/[A-Za-z]/.test(token)) {
      return `<span class="font-en">${token}</span>`;
    } else {
      return `<span class="font-hi">${token}</span>`;
    }
  }).join('');
}

/**
 * Returns a random caption from the list (excluding current one if possible).
 */
export function getRandomCaption() {
  if (CAPTIONS.length <= 1) return CAPTIONS[0];
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * CAPTIONS.length);
  } while (newIndex === currentIndex);
  currentIndex = newIndex;
  return CAPTIONS[currentIndex];
}

/**
 * Initializes caption rotation after initial delay.
 * Initial view always shows "भाई आज leg day है".
 * @param {HTMLElement} captionElement - The caption DOM node
 * @param {number} intervalMs - Rotation interval in ms (default 45000ms)
 */
export function initCaptionRotation(captionElement, intervalMs = 45000) {
  if (!captionElement) return;

  // Set initial caption formatted with dual-font spans
  captionElement.innerHTML = formatCaptionHTML(CAPTIONS[0]);

  // Rotate smoothly every intervalMs
  setInterval(() => {
    const nextCaption = getRandomCaption();
    
    // Smooth opacity fade out and fade in
    captionElement.style.opacity = '0';
    captionElement.style.transform = 'translateY(4px)';
    
    setTimeout(() => {
      captionElement.innerHTML = formatCaptionHTML(nextCaption);
      captionElement.style.opacity = '1';
      captionElement.style.transform = 'translateY(0)';
    }, 400);
  }, intervalMs);
}
