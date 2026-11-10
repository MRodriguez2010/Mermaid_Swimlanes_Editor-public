import { useMemo, useState } from "react";
import { mermaidTemplates, templateCategories, type MermaidTemplate } from "../../data/templates";

interface TemplatesBarProps {
  onSelectTemplate: (template: MermaidTemplate) => void;
}

export function TemplatesBar({ onSelectTemplate }: TemplatesBarProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const visibleTemplates = useMemo(
    () =>
      activeCategory === "All"
        ? mermaidTemplates
        : mermaidTemplates.filter((template) => template.category === activeCategory),
    [activeCategory]
  );

  return (
    <section className="templates-bar" aria-label="Diagram templates">
      <div className="template-categories" role="tablist" aria-label="Template categories">
        {templateCategories.map((category) => (
          <button
            key={category}
            type="button"
            className={category === activeCategory ? "is-active" : ""}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="template-list" aria-label="Templates">
        {visibleTemplates.map((template) => (
          <button key={template.id} type="button" onClick={() => onSelectTemplate(template)}>
            <span>{template.name}</span>
            <small>{template.category}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
