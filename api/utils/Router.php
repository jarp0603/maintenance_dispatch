<?php
declare(strict_types=1);

namespace App\Utils;

/**
 * Tiny route table. Supports path params like /work-orders/{id}.
 * A route maps METHOD + pattern -> [ControllerClass, method].
 */
final class Router
{
    /** @var array<int,array{method:string,regex:string,vars:string[],handler:array}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler): void
    {
        $vars = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', function ($m) use (&$vars) {
            $vars[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => '#^' . $regex . '$#',
            'vars'    => $vars,
            'handler' => $handler,
        ];
    }

    public function get(string $p, array $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, array $h): void   { $this->add('POST', $p, $h); }
    public function put(string $p, array $h): void    { $this->add('PUT', $p, $h); }
    public function patch(string $p, array $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, array $h): void { $this->add('DELETE', $p, $h); }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (preg_match($route['regex'], $path, $matches)) {
                array_shift($matches);
                $params = array_combine($route['vars'], $matches) ?: [];
                [$class, $action] = $route['handler'];
                $controller = new $class();
                $controller->$action($params);
                return; // controller is expected to emit a Response and exit
            }
        }
        Response::error('Not found', 404);
    }
}
