import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "CSNWorld Admin Panel",
    description: "Admin panel for managing CSNWorld users, roles, and chapters",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
