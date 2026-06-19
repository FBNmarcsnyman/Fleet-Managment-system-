import React, { useRef, useEffect, useState } from 'react';

// This lets TypeScript know that 'google' can exist on the window object.
declare global {
    interface Window {
        google: any;
    }
}

interface PlaceInfo { address: string; name?: string; phone?: string; }
interface AddressAutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    required?: boolean;
    className?: string;
    // Fires with extra details when a place is picked — used to auto-fill the
    // contact name + phone when the chosen place is a named business (Google has
    // no phone for plain street addresses).
    onPlace?: (info: PlaceInfo) => void;
}

const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({ value, onChange, placeholder, required, className, onPlace }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isApiLoaded, setIsApiLoaded] = useState(!!window.google);
    const onChangeRef = useRef(onChange);
    const onPlaceRef = useRef(onPlace);

    // Keep the handler refs up to date without re-triggering the effect
    useEffect(() => {
        onChangeRef.current = onChange;
        onPlaceRef.current = onPlace;
    }, [onChange, onPlace]);

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
                // No `types` restriction so BUSINESSES (which carry a phone) show
                // alongside plain addresses.
                fields: ['formatted_address', 'name', 'formatted_phone_number', 'international_phone_number'],
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                const fa = place?.formatted_address || '';
                const nm = (place?.name || '').trim();
                // When a BUSINESS is picked, Google gives its name separately from
                // the street address — prepend it so the company name pulls through
                // (e.g. "JUST FLOUR, 2nd Floor, Block A, …"). For a plain street
                // address, name is just part of the address, so we don't duplicate.
                const faLow = fa.toLowerCase();
                const isBusiness = nm && fa && !faLow.startsWith(nm.toLowerCase()) && !faLow.includes(nm.toLowerCase());
                const address = isBusiness ? `${nm}, ${fa}` : (fa || nm);
                if (address) {
                    onChangeRef.current(address);
                    onPlaceRef.current?.({
                        address,
                        name: nm || undefined,
                        phone: place?.formatted_phone_number || place?.international_phone_number,
                    });
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