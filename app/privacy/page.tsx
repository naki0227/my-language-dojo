import React from 'react';

export default function PrivacyPolicy() {
    return (
        <div className="max-w-4xl mx-auto p-8 text-gray-800">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">1. Introduction</h2>
                <p className="mb-4">
                    Welcome to My Language Dojo ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">2. Data We Collect</h2>
                <p className="mb-4">
                    We may collect, use, store, and transfer different kinds of personal data about you which we have grouped together follows:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li><strong>Identity Data:</strong> includes username or similar identifier.</li>
                    <li><strong>Contact Data:</strong> includes email address.</li>
                    <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
                    <li><strong>Usage Data:</strong> includes information about how you use our website, products, and services (e.g., study logs, progress).</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">3. How We Use Your Data</h2>
                <p className="mb-4">
                    We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                    <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                    <li>Where we need to comply with a legal obligation.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">4. Data Security</h2>
                <p className="mb-4">
                    We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">5. Third-Party Links</h2>
                <p className="mb-4">
                    This website may include links to third-party websites, plug-ins, and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">6. Contact Us</h2>
                <p className="mb-4">
                    If you have any questions about this privacy policy or our privacy practices, please contact us at: <a href="mailto:nakinakipal@gmail.com" className="text-blue-600 hover:underline">nakinakipal@gmail.com</a>
                </p>
            </section>
        </div>
    );
}
