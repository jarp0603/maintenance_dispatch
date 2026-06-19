<?php
declare(strict_types=1);

namespace App\Utils;

/**
 * Lightweight server-side validation. NEVER rely on the frontend for this.
 *
 * Usage:
 *   $v = new Validator($data);
 *   $v->required('username')->string('username', 1, 100);
 *   $v->required('priority')->in('priority', ['low','medium','high','urgent']);
 *   if ($v->fails()) Response::error('Validation failed', 422, $v->errors());
 */
final class Validator
{
    private array $data;
    /** @var array<string,string> */
    private array $errors = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function required(string $field): self
    {
        $val = $this->data[$field] ?? null;
        if ($val === null || (is_string($val) && trim($val) === '')) {
            $this->addError($field, 'This field is required.');
        }
        return $this;
    }

    public function string(string $field, int $min = 0, int $max = 65535): self
    {
        if (!isset($this->data[$field]) || $this->data[$field] === null) {
            return $this;
        }
        if (!is_string($this->data[$field])) {
            return $this->addError($field, 'Must be text.');
        }
        $len = mb_strlen(trim($this->data[$field]));
        if ($len < $min) {
            $this->addError($field, "Must be at least {$min} characters.");
        } elseif ($len > $max) {
            $this->addError($field, "Must be at most {$max} characters.");
        }
        return $this;
    }

    public function email(string $field): self
    {
        $val = $this->data[$field] ?? null;
        if ($val !== null && $val !== '' && !filter_var($val, FILTER_VALIDATE_EMAIL)) {
            $this->addError($field, 'Must be a valid email address.');
        }
        return $this;
    }

    public function in(string $field, array $allowed): self
    {
        $val = $this->data[$field] ?? null;
        if ($val !== null && !in_array($val, $allowed, true)) {
            $this->addError($field, 'Invalid value.');
        }
        return $this;
    }

    public function integer(string $field): self
    {
        $val = $this->data[$field] ?? null;
        if ($val !== null && $val !== '' && filter_var($val, FILTER_VALIDATE_INT) === false) {
            $this->addError($field, 'Must be a whole number.');
        }
        return $this;
    }

    public function date(string $field): self
    {
        $val = $this->data[$field] ?? null;
        if ($val !== null && $val !== '') {
            $d = \DateTime::createFromFormat('Y-m-d', $val);
            if (!$d || $d->format('Y-m-d') !== $val) {
                $this->addError($field, 'Must be a date (YYYY-MM-DD).');
            }
        }
        return $this;
    }

    private function addError(string $field, string $msg): self
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = $msg;
        }
        return $this;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string,string> */
    public function errors(): array
    {
        return $this->errors;
    }
}
