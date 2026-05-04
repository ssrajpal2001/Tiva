import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

const TEXTBOOKS: Record<string, Array<{ id: string; name: string; publisher: string; chapters: string[] }>> = {
  Math: [
    { id: "ncert_math_10", name: "Mathematics Class 10", publisher: "NCERT", chapters: ["Real Numbers", "Polynomials", "Pair of Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry", "Some Applications of Trigonometry", "Circles", "Constructions", "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"] },
    { id: "ncert_math_9", name: "Mathematics Class 9", publisher: "NCERT", chapters: ["Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations", "Introduction to Euclid Geometry", "Lines and Angles", "Triangles", "Quadrilaterals", "Areas of Parallelograms", "Circles", "Constructions", "Heron's Formula", "Surface Areas and Volumes", "Statistics", "Probability"] },
  ],
  Science: [
    { id: "ncert_sci_10", name: "Science Class 10", publisher: "NCERT", chapters: ["Chemical Reactions", "Acids, Bases and Salts", "Metals and Non-metals", "Carbon and its Compounds", "Periodic Classification", "Life Processes", "Control and Coordination", "How do Organisms Reproduce", "Heredity and Evolution", "Light – Reflection", "Human Eye", "Electricity", "Magnetic Effects", "Sources of Energy", "Our Environment", "Management of Natural Resources"] },
    { id: "ncert_sci_9", name: "Science Class 9", publisher: "NCERT", chapters: ["Matter in Our Surroundings", "Is Matter Around Us Pure", "Atoms and Molecules", "Structure of the Atom", "Cell – Fundamental Unit", "Tissues", "Diversity in Living Organisms", "Motion", "Force and Laws of Motion", "Gravitation", "Work and Energy", "Sound", "Why Do We Fall Ill", "Natural Resources", "Improvement in Food Resources"] },
  ],
  Physics: [
    { id: "ncert_phy_12", name: "Physics Part I & II Class 12", publisher: "NCERT", chapters: ["Electric Charges and Fields", "Electrostatic Potential", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics", "Wave Optics", "Dual Nature of Radiation", "Atoms", "Nuclei", "Semiconductor Electronics"] },
    { id: "ncert_phy_11", name: "Physics Part I & II Class 11", publisher: "NCERT", chapters: ["Physical World", "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion", "Work, Energy and Power", "System of Particles", "Gravitation", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"] },
  ],
  Chemistry: [
    { id: "ncert_chem_12", name: "Chemistry Part I & II Class 12", publisher: "NCERT", chapters: ["The Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "General Principles of Isolation", "p-Block Elements", "d and f Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones", "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life"] },
  ],
  Biology: [
    { id: "ncert_bio_12", name: "Biology Class 12", publisher: "NCERT", chapters: ["Reproduction in Organisms", "Sexual Reproduction in Plants", "Human Reproduction", "Reproductive Health", "Principles of Inheritance", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Strategies for Enhancement", "Microbes in Human Welfare", "Biotechnology Principles", "Biotechnology and its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity", "Environmental Issues"] },
  ],
  English: [
    { id: "ncert_eng_10", name: "First Flight Class 10", publisher: "NCERT", chapters: ["A Letter to God", "Nelson Mandela", "Two Stories about Flying", "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter", "Madam Rides the Bus", "The Sermon at Benares", "The Proposal"] },
  ],
};

export default function TextbooksScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [selectedSubject, setSelectedSubject] = useState<string>(profile?.subjects?.[0] ?? "Math");
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const subjects = Object.keys(TEXTBOOKS);
  const books = TEXTBOOKS[selectedSubject] ?? [];
  const currentBook = books.find((b) => b.id === selectedBook);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Textbook Library</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Subject selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.subjectPill,
                { backgroundColor: selectedSubject === s ? colors.primary : colors.secondary, borderColor: colors.border },
              ]}
              onPress={() => { setSelectedSubject(s); setSelectedBook(null); }}
            >
              <Text style={[styles.subjectPillText, { color: selectedSubject === s ? "#fff" : colors.foreground }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Books */}
        {!selectedBook && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{selectedSubject} Textbooks</Text>
            {books.map((book) => (
              <TouchableOpacity
                key={book.id}
                style={[styles.bookCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedBook(book.id)}
              >
                <View style={[styles.bookIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name="book" size={24} color={colors.primary} />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={[styles.bookName, { color: colors.foreground }]}>{book.name}</Text>
                  <Text style={[styles.bookPublisher, { color: colors.mutedForeground }]}>{book.publisher} · {book.chapters.length} chapters</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
            {books.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No textbooks available for {selectedSubject} yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* Chapters */}
        {selectedBook && currentBook && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.breadcrumb} onPress={() => setSelectedBook(null)}>
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={[styles.breadcrumbText, { color: colors.primary }]}>Back to books</Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{currentBook.name}</Text>
            {currentBook.chapters.map((chapter, i) => (
              <TouchableOpacity
                key={chapter}
                style={[styles.chapterCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({
                  pathname: "/chat/[sessionId]",
                  params: {
                    sessionId: "new",
                    subject: selectedSubject,
                    mode: "ask",
                    grade: profile?.grade ?? "Class 10",
                    board: profile?.board ?? "CBSE",
                    chapterContext: `Chapter ${i + 1}: ${chapter} from ${currentBook.name}`,
                  }
                })}
              >
                <View style={[styles.chapterNum, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.chapterNumText, { color: colors.foreground }]}>{i + 1}</Text>
                </View>
                <View style={styles.chapterInfo}>
                  <Text style={[styles.chapterName, { color: colors.foreground }]}>{chapter}</Text>
                  <Text style={[styles.chapterAction, { color: colors.mutedForeground }]}>Tap to start learning</Text>
                </View>
                <Ionicons name="play-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 40, padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  subjectRow: { maxHeight: 56, paddingVertical: 8 },
  subjectPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  subjectPillText: { fontSize: 14, fontWeight: "500" },
  section: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  bookCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  bookIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  bookInfo: { flex: 1 },
  bookName: { fontSize: 15, fontWeight: "600" },
  bookPublisher: { fontSize: 12, marginTop: 2 },
  emptyCard: { padding: 20, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14 },
  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  breadcrumbText: { fontSize: 14, fontWeight: "500" },
  chapterCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  chapterNum: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  chapterNumText: { fontSize: 14, fontWeight: "700" },
  chapterInfo: { flex: 1 },
  chapterName: { fontSize: 15, fontWeight: "500" },
  chapterAction: { fontSize: 12, marginTop: 2 },
});
