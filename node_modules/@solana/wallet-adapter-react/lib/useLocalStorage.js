import { useCallback, useState } from 'react';
export function useLocalStorage(key, defaultState) {
    const [value, setValue] = useState(() => {
        try {
            const value = localStorage.getItem(key);
            if (value)
                return JSON.parse(value);
        }
        catch (error) {
            console.error(error);
        }
        return defaultState;
    });
    const setLocalStorage = useCallback((newValue) => {
        if (newValue === value)
            return;
        setValue(newValue);
        try {
            if (newValue === null) {
                localStorage.removeItem(key);
            }
            else {
                localStorage.setItem(key, JSON.stringify(newValue));
            }
        }
        catch (error) {
            console.error(error);
        }
    }, [value, setValue, key]);
    return [value, setLocalStorage];
}
//# sourceMappingURL=useLocalStorage.js.map