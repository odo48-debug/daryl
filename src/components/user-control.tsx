"use client";

import { dark } from "@clerk/themes";
import { UserButton } from "@clerk/nextjs";
import { useCurrentTheme } from "@/hooks/use-current-theme";

interface Props {
    showName?: boolean;
    
};

export const UserControl = ({ showName }: Props) => {

    const currentTheme = useCurrentTheme();


    return (
        <UserButton 
        showName={showName}
        appearance={{
            elements: {
                userButtonBox: "rounded-md!",
                userButtonAvatar: "rounded-md! size-8!",
                userButtonTrigger: "rounded-sm!"
            },
            baseTheme: currentTheme === "dark" ? dark : undefined,
        }}
        />
    );
}