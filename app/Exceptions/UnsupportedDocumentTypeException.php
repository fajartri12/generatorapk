<?php

namespace App\Exceptions;

use InvalidArgumentException;

/**
 * Raised when a caller asks for a document type the product has no prompt for.
 */
class UnsupportedDocumentTypeException extends InvalidArgumentException
{
    public function __construct(public readonly string $documentType)
    {
        parent::__construct("Tipe dokumen [{$documentType}] tidak didukung.");
    }
}
