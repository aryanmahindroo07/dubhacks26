import styles from "./DropdownMenu.module.css";
import logo from '../../assets/logo.jpg';

export default function DropdownMenu () {
    return (
        <div className={styles.menu}>
            <div className = {styles.header}>
                <div className = {styles.title}>
                    <img className = {styles.icon} src = {logo} />
                    <div className = {styles.requestFlow}>Mise</div>
                </div>
                <div className = {styles.xButton}>X</div>
            </div>
            <div className = {styles.dataBox}>
                <span className = {styles.label}>API calls seen</span>
                <span className = {styles.data}>12,486</span>
                <span className = {styles.description}>requests for app data</span>
            </div>
            <div className = {styles.dataBox}>
                <span className = {styles.label}>Likely next calls</span>
                <span className = {styles.data}>12,486</span>
                <span className = {styles.description}>possible next data requests</span>
            </div>
            <div className = {styles.dataBox}>
                <span className = {styles.label}>Potential time saved</span>
                <span className = {styles.data}>18.6 min</span>
                <span className = {styles.description}>Estimate from data</span>
            </div>
            <div className = {styles.dataBox}>
                <span className = {styles.label}>Typical response</span>
                <span className = {styles.data}>184 ms</span>
                <span className = {styles.description}>Estimate from data</span>
            </div>
            <div className = {styles.footerBox}>
                <div className = {styles.topRow}>
                    <div className = {styles.leftItems}>
                        <span>✨ </span>
                        <span class = {styles.likelyNext}>LIKELY NEXT</span>
                    </div>
                    <span className = {styles.right}>94%</span> {/* what the hell does this mean */}
                </div>
                <span class = {styles.likelyNextText}>After a product search, matching results are often needed next.</span>
                <span className = {styles.smallText}>Example pattern from sample data, not live browser activity.</span>
            </div>
            <div className = {styles.footer}>
                <span>View detailed metrics</span>
                <span>➜</span>
            </div>
        </div>
    );
}
