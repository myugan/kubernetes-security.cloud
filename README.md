# Kubernetes Security Learning Platform

A learning platform for Kubernetes security covering both offensive and defensive topics from beginner to advanced levels.

## Features

- **Glossary**: Comprehensive definitions of Kubernetes security terms managed via Markdown files
- **Topics**: In-depth lessons with impact and mitigation strategies
- **Attack Paths**: Step-by-step visualizations of attack paths generated from YAML files
- **Clean Design**: Simple, readable layout optimized for learning

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:4321](http://localhost:4321) in your browser

### Building for Production

```bash
npm run build
```

The built site will be in the `dist/` directory.

## Project Structure

```
├── src/
│   ├── components/          # Reusable components
│   │   └── AttackPathVisualization.astro
│   ├── content/             # Content collections
│   │   ├── glossary/        # Glossary entries (Markdown)
│   │   ├── topics/          # Topic lessons (Markdown)
│   │   └── attack-paths/    # Attack path definitions (YAML)
│   ├── layouts/             # Page layouts
│   ├── pages/               # Route pages
│   └── types.ts             # TypeScript type definitions
├── astro.config.mjs         # Astro configuration
└── package.json
```

## Adding Content

### Adding a Glossary Entry

Create a new Markdown file in `src/content/glossary/`:

```markdown
---
title: Your Term
description: Brief description
category: concept
relatedTerms:
  - Related Term 1
  - Related Term 2
---

Your detailed content here...
```

### Adding a Topic

Create a new Markdown file in `src/content/topics/`:

```markdown
---
title: Your Topic
description: Brief description
level: beginner
category: defensive
impact: Description of impact
mitigation: Description of mitigation
prerequisites:
  - Prerequisite 1
---

Your topic content here...
```

### Adding an Attack Path

Create a new YAML file in `src/content/attack-paths/`:

```yaml
title: "Attack Path Title"
description: "Description of the attack path"
difficulty: beginner
category: "Category Name"
steps:
  - id: "step1"
    title: "Step Title"
    description: "Step description"
    type: initial
    connections:
      - "step2"
  - id: "step2"
    title: "Next Step"
    description: "Next step description"
    type: lateral
```

## Technologies

- [Astro](https://astro.build/) - Web framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Mermaid](https://mermaid.js.org/) - Diagram generation
- [MDX](https://mdxjs.com/) - Markdown with JSX support

## License

MIT