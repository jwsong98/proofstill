"""Static dependency rules; infra/app.py is the composition root."""
import ast
from pathlib import Path
import sys

LAYERS = {
    'domain': {'domain'},
    'usecase': {'usecase', 'domain'},
    'app': {'app', 'usecase'},
    'infra': {'infra', 'domain'},
}
WEB_PACKAGES = {'fastapi', 'starlette', 'pydantic'}


def violations(root: Path) -> list[str]:
    files = sorted(file for layer in LAYERS for file in (root / layer).rglob('*.py'))
    modules = {'.'.join(file.relative_to(root).with_suffix('').parts).removesuffix('.__init__'): file
               for file in files}
    graph = {name: set() for name in modules}
    errors = []
    for name, file in modules.items():
        relative = file.relative_to(root)
        layer = relative.parts[0]
        allowed = LAYERS[layer] | ({'app', 'usecase'} if relative.as_posix() == 'infra/app.py' else set())
        try:
            tree = ast.parse(file.read_text(), filename=str(relative))
        except SyntaxError as error:
            errors.append(f'{relative.as_posix()}:{error.lineno}: {error.msg}')
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                targets = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                package = list(relative.parts[:-1])
                if node.level:
                    if node.level > len(package):
                        errors.append(f'{relative.as_posix()}:{node.lineno}: invalid relative import')
                        continue
                    package = package[:len(package) - node.level + 1]
                else:
                    package = []
                base = '.'.join(package + ([node.module] if node.module else []))
                targets = [base] + [f'{base}.{alias.name}' for alias in node.names if alias.name != '*']
            else:
                continue
            for target in targets:
                top = target.split('.')[0]
                if top in LAYERS:
                    permitted = top in allowed
                elif layer in {'domain', 'usecase'}:
                    permitted = top in sys.stdlib_module_names
                elif layer == 'app':
                    permitted = top in sys.stdlib_module_names or top in WEB_PACKAGES
                else:
                    permitted = True
                if not permitted:
                    errors.append(f'{relative.as_posix()}:{node.lineno}: forbidden dependency {layer} -> {target}')
                parts = target.split('.')
                for length in range(1, len(parts) + 1):
                    dependency = '.'.join(parts[:length])
                    if dependency in modules:
                        graph[name].add(dependency)
    done, active = set(), []

    def visit(name):
        if name in active:
            errors.append('dependency cycle: ' + ' -> '.join(active[active.index(name):] + [name]))
            return
        if name in done:
            return
        active.append(name)
        for dependency in sorted(graph[name]):
            visit(dependency)
        active.pop()
        done.add(name)

    for name in sorted(graph):
        visit(name)
    return sorted(set(errors))


if __name__ == '__main__':
    errors = violations(Path(__file__).resolve().parents[1])
    print('\n'.join(errors) if errors else 'Architecture OK')
    raise SystemExit(bool(errors))
