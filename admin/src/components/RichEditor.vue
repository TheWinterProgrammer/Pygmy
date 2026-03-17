<template>
  <div class="rich-editor">
    <div class="toolbar" v-if="editor">
      <button type="button" @click="editor.chain().focus().toggleBold().run()" :class="{ active: editor.isActive('bold') }" title="Bold">B</button>
      <button type="button" @click="editor.chain().focus().toggleItalic().run()" :class="{ active: editor.isActive('italic') }" title="Italic"><em>I</em></button>
      <button type="button" @click="editor.chain().focus().toggleStrike().run()" :class="{ active: editor.isActive('strike') }" title="Strikethrough"><s>S</s></button>
      <div class="sep" />
      <button type="button" @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ active: editor.isActive('heading', { level: 1 }) }">H1</button>
      <button type="button" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor.isActive('heading', { level: 2 }) }">H2</button>
      <button type="button" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: editor.isActive('heading', { level: 3 }) }">H3</button>
      <div class="sep" />
      <button type="button" @click="editor.chain().focus().toggleBulletList().run()" :class="{ active: editor.isActive('bulletList') }">• List</button>
      <button type="button" @click="editor.chain().focus().toggleOrderedList().run()" :class="{ active: editor.isActive('orderedList') }">1. List</button>
      <button type="button" @click="editor.chain().focus().toggleBlockquote().run()" :class="{ active: editor.isActive('blockquote') }">"</button>
      <button type="button" @click="editor.chain().focus().setHorizontalRule().run()">—</button>
      <div class="sep" />
      <button type="button" @click="setLink" :class="{ active: editor.isActive('link') }">🔗</button>
      <button type="button" @click="editor.chain().focus().unsetLink().run()" v-if="editor.isActive('link')">✕ Link</button>
      <div class="sep" />
      <button type="button" @click="editor.chain().focus().undo().run()">↩</button>
      <button type="button" @click="editor.chain().focus().redo().run()">↪</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

const props = defineProps({ modelValue: { type: String, default: '' }, placeholder: { type: String, default: 'Write something…' } })
const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  }
})

watch(() => props.modelValue, val => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val, false)
  }
})

function setLink() {
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt('URL', prev || 'https://')
  if (!url) return
  editor.value.chain().focus().setLink({ href: url }).run()
}

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
.rich-editor {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface2);
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.1rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.toolbar button {
  padding: 0.2rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 600;
}
.toolbar button:hover { background: var(--surface2); color: var(--text); }
.toolbar button.active { background: hsl(355,70%,20%); color: var(--accent); }
.sep { width: 1px; height: 16px; background: var(--border); margin: 0 0.25rem; }
</style>

<style>
.editor-content .tiptap {
  padding: 1rem;
  min-height: 200px;
  outline: none;
  font-size: 0.92rem;
  line-height: 1.8;
  color: var(--text);
}
.editor-content .tiptap h1 { font-size: 1.6rem; margin: 1rem 0 0.5rem; }
.editor-content .tiptap h2 { font-size: 1.3rem; margin: 1rem 0 0.4rem; }
.editor-content .tiptap h3 { font-size: 1.1rem; margin: 0.8rem 0 0.3rem; }
.editor-content .tiptap p  { margin-bottom: 0.8rem; }
.editor-content .tiptap ul, .editor-content .tiptap ol { padding-left: 1.5rem; margin-bottom: 0.8rem; }
.editor-content .tiptap blockquote {
  border-left: 3px solid var(--accent);
  margin: 0.8rem 0;
  padding-left: 1rem;
  color: var(--text-muted);
}
.editor-content .tiptap a { color: var(--accent); }
.editor-content .tiptap hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
.editor-content .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
