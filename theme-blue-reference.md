# Blue Theme Color Reference

This file contains the original blue theme color values for the landing page.
Use this to revert from the green theme back to blue if needed.

## RGB Values (for inline styles)

```
Blue: rgba(59, 130, 246, opacity)
```

## Tailwind Classes

| Element | Blue Class |
|---------|------------|
| Selection | `selection:bg-blue-500/30` |
| "build" text gradient | `bg-gradient-to-t from-blue-600 to-blue-100` |
| Input ring focus | `focus-within:ring-blue-500/30` |
| Button (active) | `bg-blue-600 hover:bg-blue-500` |
| Button (disabled) | `bg-blue-900/40` |
| Project card hover bg | `group-hover:bg-blue-500/10` |
| Project card hover text | `group-hover:text-blue-500` |
| Project card arrow | `group-hover:bg-blue-500` |

## Inline Style Gradients (rgba format)

### Horizon Glow (side sources)
```css
radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.8) 0%, transparent 50%),
radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.8) 0%, transparent 50%)
```

### Center Fade Arc (inside overflow container)
```css
radial-gradient(ellipse 60% 40% at 50% 80%, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.15) 50%, transparent 80%)
```

### Center Fade Arc (outside overflow container)
```css
radial-gradient(ellipse 90% 100% at 50% 100%, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.2) 30%, rgba(59, 130, 246, 0.08) 60%, transparent 90%)
```

### Planet Edge Box Shadow
```css
0 -5px 0 0 rgba(59, 130, 246, 0.1),
0 -10px 0 0 rgba(59, 130, 246, 1.0),
0 -14px 0 0 rgba(59, 130, 246, 0.2),
0 -50px 100px -10px rgba(59, 130, 246, 0.4)
```

### Secondary Rim Box Shadow
```css
0 -20px 60px rgba(59, 130, 246, 0.3)
```
