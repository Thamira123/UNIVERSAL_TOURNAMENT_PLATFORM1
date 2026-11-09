import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { sports } from "@/lib/sports";

export default function SportsDirectoryPage() {
  return <AppShell title="Choose Your Sport" subtitle="Select a sport to explore tournaments and manage competitions.">
    <div className="sports-directory-intro"><span>UTMP SPORTS DIRECTORY</span><span>{String(sports.length).padStart(2, "0")} SPORTS AVAILABLE</span></div>
    <section className="sports-directory-grid" aria-label="Choose a sport">
      {sports.map((sport, index) => <article className="sports-directory-card" key={sport.key} style={{ backgroundImage: `linear-gradient(180deg, #10241b06 20%, #10241bdc 100%), url(${sport.image})` }}>
        <div className="sports-directory-card-top"><span className="sports-directory-icon" aria-hidden="true">{sport.icon}</span><span>0{index + 1} / 02</span></div>
        <div className="sports-directory-card-copy"><span className="sports-directory-category">{sport.category}</span><h2>{sport.name}</h2><p>{sport.description}</p><Link className="sports-directory-link" href={sport.route}>View tournaments <span aria-hidden="true">↗</span></Link></div>
      </article>)}
    </section>
    <div className="sports-directory-foot"><span>More sports will be added as UTMP grows.</span><Link href="/profile">Go to your workspace <span aria-hidden="true">→</span></Link></div>
  </AppShell>;
}
