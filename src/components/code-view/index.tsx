import Prism from "prismjs";
import { useEffect, useState } from "react";

// Importar en el orden correcto para evitar problemas de dependencia
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-typescript";

import "./code-theme.css";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { CheckIcon, XIcon } from "lucide-react";

interface Props {
    code: string;
    lang: string;
    onCodeChange?: (newCode: string) => void;
    readOnly?: boolean;
}

export const CodeView = ({ 
    code, 
    lang,
    onCodeChange,
    readOnly = true
}: Props) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedCode, setEditedCode] = useState(code);
    
    useEffect(() => {
        if (!isEditing) {
            Prism.highlightAll();
        }
    }, [code, isEditing]);
    
    useEffect(() => {
        setEditedCode(code);
    }, [code]);
    
    const handleEditToggle = () => {
        if (readOnly) return;
        setIsEditing(!isEditing);
    };
    
    const handleSave = () => {
        if (onCodeChange) {
            onCodeChange(editedCode);
        }
        setIsEditing(false);
    };
    
    const handleCancel = () => {
        setEditedCode(code);
        setIsEditing(false);
    };
    
    if (isEditing) {
        return (
            <div className="relative h-full">
                <Textarea
                    value={editedCode}
                    onChange={(e) => setEditedCode(e.target.value)}
                    className="h-full w-full font-mono text-xs p-2 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 rounded-none"
                    spellCheck={false}
                />
                <div className="absolute top-2 right-2 flex gap-2">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0" 
                        onClick={handleSave}
                    >
                        <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 w-8 p-0" 
                        onClick={handleCancel}
                    >
                        <XIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }
    
    return (
        <pre
          className="p-2 bg-transparent border-none rounded-none m-0 text-xs cursor-pointer"
          onClick={handleEditToggle}
        >
            <code className={`language-${lang}`}>
                {code}
            </code>
        </pre>
    );
};