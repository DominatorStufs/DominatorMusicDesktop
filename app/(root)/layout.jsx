import Player from "@/components/cards/player";
import Footer from "@/components/page/footer";
import Header from "@/components/page/header";

export default function RootLayout({ children }) {
    return (
        <main>
            <Header />
            {children}
            <Player />
            <Footer />
        </main>
    )
}
