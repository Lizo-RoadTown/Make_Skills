# ChatGPT

Custom GPTs, system prompts, and instruction files for ChatGPT.

## What goes here

| Type | Format | Where it lives |
|------|--------|----------------|
| **Custom GPT** | System prompt + Knowledge files + Actions schema | chat.openai.com/gpts |
| **Custom instructions** | Plain text in two fields | ChatGPT settings |
| **Project instructions** | System prompt + uploaded files | ChatGPT Projects sidebar |
| **Action / Tool** | OpenAPI 3.x JSON or YAML | Uploaded into a Custom GPT |

## Custom GPT structure

A Custom GPT is built in the GPT Builder UI but the artifacts you should
keep version-controlled are:

```
my-gpt/
├── instructions.md       # The "Instructions" textarea content
├── conversation-starters.md
├── knowledge/            # Files to upload as Knowledge
│   └── *.md, *.pdf, *.txt
├── actions/              # OpenAPI schemas for Actions
│   └── api.yaml
└── README.md             # How to recreate this GPT
```

When you update a GPT, copy the latest text out of the builder and commit it
here. The builder is the runtime; this folder is the source of truth.

## Custom instructions (account-wide)

`custom-instructions.md`:

```markdown
## What I'd like ChatGPT to know about me
<2-3 sentences on your role, projects, preferences>

## How I'd like ChatGPT to respond
<voice, length, format preferences>
```

These go in **Settings → Personalization → Custom instructions**. The two
fields are limited to 1500 characters each.

## ChatGPT Projects

For per-project instructions and files, use the Projects feature
(formerly Workspaces). Same artifacts, but scoped to one project:

```
my-project/
├── project-instructions.md
└── files/
    └── <files to upload>
```

## How to install

These can't be installed via CLI — ChatGPT artifacts are configured in the
web UI. This folder is your **source of truth** to recreate them if lost.

To install: copy text from this folder into the appropriate UI field, upload
files via the Knowledge panel, paste OpenAPI schemas into the Actions builder.

## References

- [Creating a GPT](https://help.openai.com/en/articles/8554397-creating-a-gpt)
- [GPT actions](https://platform.openai.com/docs/actions)
- [Custom instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions-faq)
- [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)

## GPTs here

(none yet)
