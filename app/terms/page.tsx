import React from 'react';

export default function TermsOfService() {
    return (
        <div className="max-w-4xl mx-auto p-8 text-gray-800">
            <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
            <p className="mb-4 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">1. Agreement to Terms</h2>
                <p className="mb-4">
                    By accessing or using My Language Dojo (<a href="https://enludus.vercel.app" className="text-blue-600 hover:underline">https://enludus.vercel.app</a>), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our services.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">2. Use License</h2>
                <p className="mb-4">
                    Permission is granted to temporarily download one copy of the materials (information or software) on My Language Dojo's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>modify or copy the materials;</li>
                    <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
                    <li>attempt to decompile or reverse engineer any software contained on My Language Dojo's website;</li>
                    <li>remove any copyright or other proprietary notations from the materials; or</li>
                    <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">3. Disclaimer</h2>
                <p className="mb-4">
                    The materials on My Language Dojo's website are provided on an 'as is' basis. My Language Dojo makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">4. Limitations</h2>
                <p className="mb-4">
                    In no event shall My Language Dojo or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on My Language Dojo's website, even if My Language Dojo or a My Language Dojo authorized representative has been notified orally or in writing of the possibility of such damage.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">5. Accuracy of Materials</h2>
                <p className="mb-4">
                    The materials appearing on My Language Dojo's website could include technical, typographical, or photographic errors. My Language Dojo does not warrant that any of the materials on its website are accurate, complete or current. My Language Dojo may make changes to the materials contained on its website at any time without notice. However My Language Dojo does not make any commitment to update the materials.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-4">6. Governing Law</h2>
                <p className="mb-4">
                    These terms and conditions are governed by and construed in accordance with the laws of Japan and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
                </p>
            </section>
        </div>
    );
}
