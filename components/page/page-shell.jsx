// Shared page container.
//
// Every page previously hardcoded its own padding ("px-6 md:px-20 lg:px-32",
// "py-12 -mt-9 px-6 ...") so content width jumped around when navigating
// between home, search, album and library. One component keeps them aligned
// and leaves room at the bottom for the fixed player bar.

export default function PageShell({ children, className = "" }) {
    return (
        <main className={`px-4 py-5 sm:px-6 md:px-12 lg:px-20 xl:px-28 pb-28 ${className}`}>
            {children}
        </main>
    );
}
