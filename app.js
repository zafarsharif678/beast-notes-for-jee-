const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const transcript = $('#transcript');
const toast = $('#toast');
let selectedDepth = 'summary';
let currentProject = null;
const transcriptApiUrl = window.NOTELY_API_URL || '/api/transcript';
const sampleTranscript = `[00:00] Today we will understand Newton's second law of motion. It tells us how force changes the motion of an object.
[00:18] On the board: Force equals mass times acceleration, written as F = ma. Force is measured in newtons, mass in kilograms, and acceleration in metres per second squared.
[00:48] A force is a push or a pull. If the net force on an object is zero, its acceleration is zero. This does not mean it stops; it may continue at constant velocity.
[01:15] Consider a 2 kilogram cart. If we push it with 10 newtons, its acceleration is force divided by mass: 10 divided by 2 equals 5 metres per second squared.
[01:48] The important word is net force. Two equal forces in opposite directions cancel each other. We add forces as vectors before applying F = ma.
[02:20] On the board: rearrange the equation as a = F/m and m = F/a. Always check that your units make sense.
[02:48] In everyday life, a heavier shopping cart needs more force than an empty cart to get the same acceleration. That is why mass measures inertia.`;

function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200); }
function cleanText(text) { return text.replace(/\r/g, '').replace(/^\d+\s*$/gm, '').replace(/\n{2,}/g, '\n').trim(); }
function splitSentences(text) { return text.replace(/\n/g, ' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter((s) => s.length > 18) || []; }
function escapeHtml(value) { return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function timestampFor(sentence) { const found = sentence.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/); return found ? `<span class="timestamp">${found[1]}</span>` : ''; }
function plainSentence(sentence) { return sentence.replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/g, '').trim(); }
function importantTerms(text) { const stop = new Set('about after again also and are because been before but can could did does for from have into its just more most not now of on or our out over should that the their then there these this those to too under was were what when where which while will with you your'); const words = text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []; const counts = {}; words.forEach((word) => { if (!stop.has(word)) counts[word] = (counts[word] || 0) + 1; }); return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([word]) => word); }
function topicTitle(text) { const first = plainSentence(splitSentences(text)[0] || 'Lecture notes').replace(/^(today|in this lecture|we will)\s+/i, ''); return first.length > 62 ? `${first.slice(0, 59)}…` : first; }
function bulletList(sentences, limit) { return `<ul>${sentences.slice(0, limit).map((sentence) => `<li>${escapeHtml(plainSentence(sentence))}${timestampFor(sentence)}</li>`).join('')}</ul>`; }
function generateNoteHtml(text, depth, language, custom) {
  const sentences = splitSentences(text); const title = topicTitle(text); const terms = importantTerms(text);
  const keySentences = sentences.filter((sentence) => /is |means|equals|important|because|therefore|defined|formula|equation/i.test(sentence));
  const highlights = keySentences.length ? keySentences : sentences;
  const board = sentences.filter((sentence) => /on the board|diagram|equation|formula|written/i.test(sentence));
  const intro = `A ${depth} set of notes created from the supplied ${language} lecture transcript.`;
  let html = `<h1>${escapeHtml(title)}</h1><p class="note-subtitle">${escapeHtml(intro)}</p><h2 id="overview">Overview</h2><p>${escapeHtml(plainSentence(sentences[0] || text))}</p><h2 id="ideas">Key ideas</h2>${bulletList(highlights, depth === 'summary' ? 4 : depth === 'detailed' ? 7 : 10)}`;
  if (depth !== 'summary') html += `<h2 id="terms">Essential terms</h2><ul>${terms.map((term) => `<li><b>${escapeHtml(term[0].toUpperCase() + term.slice(1))}</b> — mentioned in the lecture; revisit its surrounding explanation in the source.</li>`).join('')}</ul>`;
  if (board.length) html += `<h2 id="board">Board & visual callouts</h2>${board.slice(0, depth === 'deep' ? 4 : 2).map((item) => `<blockquote class="board-note">${escapeHtml(plainSentence(item))}${timestampFor(item)}</blockquote>`).join('')}`;
  if (depth === 'deep') { const questions = highlights.slice(0, 4).map((item, i) => `<li>How would you explain this idea in your own words: “${escapeHtml(plainSentence(item).slice(0, 95))}”?</li>`).join(''); html += `<h2 id="review">Teach-back & revision</h2><p>Use these prompts after reviewing the original lecture:</p><ul>${questions}</ul>`; }
  if (custom.trim()) html += `<h2 id="focus">Your focus</h2><blockquote>${escapeHtml(custom)}<br /><small>Use this as a study lens while reviewing the source.</small></blockquote>`;
  html += `<h2 id="source">Source check</h2><p>These notes summarize only the transcript you supplied. Rewatch the linked lecture to verify diagrams, demonstrations, or details that are not described in the transcript.</p>`;
  return { html, title };
}
function renderToc() { $('#note-toc').innerHTML = $$('#note-paper h2').map((heading) => `<a href="#${heading.id}">${heading.textContent}</a>`).join(''); }
function createProject(project) { const list = $('#project-list'); $('.empty-projects')?.remove(); const node = $('#project-template').content.cloneNode(true); node.querySelector('.project-depth').textContent = project.depth.toUpperCase(); node.querySelector('h3').textContent = project.title; node.querySelector('p').textContent = 'Generated just now'; node.querySelector('.open-project').addEventListener('click', () => { $('#results').scrollIntoView({ behavior: 'smooth' }); }); list.prepend(node); }
function processNotes() { const text = cleanText(transcript.value); if (text.split(/\s+/).filter(Boolean).length < 18) { showToast('Please add a little more transcript text (at least 18 words).'); transcript.focus(); return; } const button = $('#generate'); button.disabled = true; button.textContent = 'Structuring your notes…'; setTimeout(() => { const result = generateNoteHtml(text, selectedDepth, $('#language').value, $('#customize').value); currentProject = { title: result.title, depth: selectedDepth, html: result.html }; $('#note-title').textContent = result.title; const url = $('#lecture-url').value.trim(); $('#source-meta').textContent = `${selectedDepth[0].toUpperCase() + selectedDepth.slice(1)} notes · ${$('#word-count').textContent}${url ? ' · Lecture link attached' : ''}`; $('#note-paper').innerHTML = result.html; renderToc(); $('#results').classList.remove('hidden'); createProject(currentProject); $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }); button.disabled = false; button.innerHTML = 'Generate my notes <span>→</span>'; showToast('Your notes are ready. Review, then download as PDF.'); }, 450); }
function updateWordCount() { const count = cleanText(transcript.value).split(/\s+/).filter(Boolean).length; $('#word-count').textContent = `${count} word${count === 1 ? '' : 's'}`; }
function downloadPdf() { if (!currentProject) return; document.title = `${currentProject.title} — Notely`; window.print(); }

$$('.source-tab').forEach((tab) => tab.addEventListener('click', () => { $$('.source-tab').forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', item === tab); }); $('#link-panel').classList.toggle('hidden', tab.dataset.mode !== 'link'); $('#file-panel').classList.toggle('hidden', tab.dataset.mode !== 'transcript'); }));
$('#transcript-file').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { showToast('That file is larger than 10 MB.'); return; } try { transcript.value = cleanText(await file.text()); $('#file-name').textContent = `Loaded ${file.name}`; updateWordCount(); showToast('Transcript loaded. Choose a depth and generate your notes.'); } catch { showToast('We could not read that file. Please use a text-based TXT, SRT, VTT or MD file.'); } });
$('#load-sample').addEventListener('click', () => { transcript.value = sampleTranscript; updateWordCount(); showToast('Sample lecture loaded — try generating all three depths.'); });
transcript.addEventListener('input', updateWordCount);
$$('.depth-card').forEach((card) => card.addEventListener('click', () => { $$('.depth-card').forEach((item) => item.classList.toggle('active', item === card)); selectedDepth = card.dataset.depth; }));
$('#generate').addEventListener('click', processNotes); $('#download-pdf').addEventListener('click', downloadPdf); $('#edit-notes').addEventListener('click', () => $('#create').scrollIntoView({ behavior: 'smooth' })); $('#new-note').addEventListener('click', () => $('#create').scrollIntoView({ behavior: 'smooth' }));
