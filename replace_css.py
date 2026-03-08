import re

with open('src/index.css', 'r') as f:
    content = f.read()

# We need to find @media (prefers-color-scheme: dark) { ... }
# and replace it with html.dark ...

def replacer(match):
    inner = match.group(1)
    lines = inner.split('\n')
    new_lines = []
    for line in lines:
        if '{' in line:
            selector = line.replace('{', '').strip()
            if selector == ':root':
                new_lines.append('html.dark {')
            else:
                new_lines.append(f'html.dark {selector} {{')
        elif line.startswith('  '):
            new_lines.append(line[2:])
        else:
            new_lines.append(line)
    return '\n'.join(new_lines) + '\n'

# This regex matches @media... { followed by anything non-greedy until a line with just '}'
pattern = r'@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}'
new_content = re.sub(pattern, replacer, content)

with open('src/index.css', 'w') as f:
    f.write(new_content)

print("Replaced!")
