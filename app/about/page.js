import Link from "next/link";

export const metadata = { title: "About · Black Friday Hunter" };

export default function About() {
  return (
    <main className="wrap about">
      <Link href="/" className="back">← Back to the deals</Link>
      <h1>About Black Friday Hunter</h1>
      <p>Black Friday Hunter gathers Black Friday and Cyber Monday sales into one place you can search, filter and sort by how good the deal is.</p>
      <h2>Where the deals come from</h2>
      <p>Every day, an AI assistant searches the web for each brand on our list and for the best deals in each category. Each deal links to the page where it was found. Deals are published automatically, so always confirm the price and dates on the retailer’s site before you buy.</p>
      <h2>How deals are ranked</h2>
      <p>The deal score is mostly the discount percent, with a bonus for the dollars you save. A $400 TV at 40% off ranks above $8 socks at 40% off.</p>
      <h2>Links</h2>
      <p>Some links may be affiliate links, which means we may earn a small commission at no cost to you.</p>
    </main>
  );
}
