import React, { useRef, useEffect, useState } from 'react';

// This lets TypeScript know that 'google' can exist on the window object.
declare global {
    interface Window {
        google: any;
    }
}

interface AddressAutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    required?: boolean;
    className?: string;
}

const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({ value, onChange, placeholder, required, className }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isApiLoaded, setIsApiLoaded] = useState(!!window.google);
    const onChangeRef = useRef(onChange);

    // Keep the onChange handler ref up to date without re-triggering the effect
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Effect to listen for the API load event
    useEffect(() => {
        const handleApiLoad = () => {
            setIsApiLoaded(true);
        };

        if (!isApiLoaded) {
            window.addEventListener('google-maps-api-loaded', handleApiLoad);
        }

        return () => {
            window.removeEventListener('google-maps-api-loaded', handleApiLoad);
        };
    }, [isApiLoaded]);

    // Effect to initialize the autocomplete widget once the API is loaded
    useEffect(() => {
        let autocomplete: any = null;
        const inputElement = inputRef.current;

        if (isApiLoaded && inputElement && window.google?.maps?.places) {
            autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
                componentRestrictions: { country: 'za' }, // Restrict suggestions to South Africa
                fields: ['formatted_address'],
                types: ['address'],
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place && place.formatted_address) {
                    onChangeRef.current(place.formatted_address);
                }
            });
        }

        // Cleanup function to prevent memory leaks
        return () => {
            if (autocomplete && window.google?.maps?.event) {
                window.google.maps.event.clearInstanceListeners(autocomplete);
            }
             // The pac-container is the suggestions dropdown. Google Maps API adds it to the body.
            // On cleanup, we should remove it to prevent multiple dropdowns if the component re-mounts.
            const pacContainers = document.querySelectorAll('.pac-container');
            pacContainers.forEach(container => container.remove());
        };
    }, [isApiLoaded]); // Removed onChange from dependency array to prevent re-initialization

    return (
        <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className={className}
        />
    );
};

export default AddressAutocompleteInput;