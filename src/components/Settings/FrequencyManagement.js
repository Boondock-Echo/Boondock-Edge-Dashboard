import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Search, X, Filter, RotateCw, Check, AlertTriangle, 
    Save, RadioTower } from "lucide-react";
import { CTCSS_TONES, DCS_CODES } from "./tone-codes";

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import tableStyles from '../ui/Table.module.css';
import modalStyles from '../ui/Modal.module.css';
import { apiFetch } from "../../utils/apiClient";
const FrequencyManagement = () => {
    // Core state management
    const [frequencies, setFrequencies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // UI state management
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // create, edit, or delete
    const [selectedFrequency, setSelectedFrequency] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState("");
    const dialogRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        frequency: "",
        type: "NFM",
        tone: "",
        tag: "",
        person: "",
        status: "active"
    });

    // Preview model state
    const [previewModel, setPreviewModel] = useState({
        displayName: "",
        frequencyDisplay: "",
        typeDisplay: "",
        toneDisplay: "",
        tagDisplay: "",
        personDisplay: ""
    });

    // Update preview whenever form data changes
    useEffect(() => {
        setPreviewModel({
            displayName: formData.name || "Untitled Frequency",
            frequencyDisplay: formData.frequency ? `${formData.frequency} MHz` : "-- MHz",
            typeDisplay: formData.type || "NFM",
            toneDisplay: formData.tone || "None",
            tagDisplay: formData.tag || "None",
            personDisplay: formData.person || "Unassigned"
        });
    }, [formData]);

    // Fetch frequencies on component mount
    useEffect(() => {
        fetchFrequencies();
    }, []);

    // API Functions
    const fetchFrequencies = async () => {
        try {
            setIsLoading(true);
            const response = await apiFetch(`/frequencies`);
            if (!response.ok) throw new Error("Failed to fetch frequencies");
            const data = await response.json();
            setFrequencies(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to fetch frequencies");
        } finally {
            setIsLoading(false);
        }
    };

    const createFrequency = async (frequencyData) => {
        try {
            const response = await apiFetch(`/frequencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(frequencyData),
            });
            if (!response.ok) throw new Error("Failed to create frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency added successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to create frequency");
            return false;
        }
    };

    const updateFrequency = async (id, frequencyData) => {
        try {
            const response = await apiFetch(`/frequencies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(frequencyData),
            });
            if (!response.ok) throw new Error("Failed to update frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency updated successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to update frequency");
            return false;
        }
    };

    const deleteFrequency = async (id) => {
        try {
            const response = await apiFetch(`/frequencies/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error("Failed to delete frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency deleted successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to delete frequency");
            return false;
        }
    };

    // UI Helper Functions
    const showTemporaryNotification = (message) => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };

    // Form Handling Functions
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormData({
            name: "",
            frequency: "",
            type: "NFM",
            tone: "",
            tag: "",
            person: "",
            status: "active"
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let success = false;

        if (modalMode === "create") {
            success = await createFrequency(formData);
        } else if (modalMode === "edit" && selectedFrequency) {
            success = await updateFrequency(selectedFrequency.id, formData);
        }

        if (success) {
            setIsModalOpen(false);
            resetForm();
        }
    };

    const handleDelete = async () => {
        if (selectedFrequency) {
            const success = await deleteFrequency(selectedFrequency.id);
            if (success) {
                setIsModalOpen(false);
                setSelectedFrequency(null);
            }
        }
    };

    const openModal = (mode, frequency = null) => {
        setModalMode(mode);
        setSelectedFrequency(frequency);
        if (mode === "edit" && frequency) {
            setFormData(frequency);
        } else if (mode === "create") {
            resetForm();
        }
        setIsModalOpen(true);
    };

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (isModalOpen && !dialog.open) dialog.showModal();
        if (!isModalOpen && dialog.open) dialog.close();
    }, [isModalOpen]);

    const renderModal = () => (
        <dialog
            ref={dialogRef}
            className={modalStyles.dialog}
            onCancel={(event) => { event.preventDefault(); setIsModalOpen(false); }}
        >
            
            {/* Modal container - improved positioning and scroll handling */}
            <div className={modalStyles.body}>
                    {/* Modal header */}
                    <div className="rowBetween">
                        <h3 className={cardStyles.title}>
                            {modalMode === 'create' ? 'Add New Frequency' :
                             modalMode === 'edit' ? 'Edit Frequency' : 'Delete Frequency'}
                        </h3>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.icon}`}
                        >
                            <X className="iconMedium" />
                        </button>
                    </div>

                    {modalMode !== 'delete' ? (
                        <>
                            {/* Preview Card - updated styling */}
                            <div >
                                <h4 className={cardStyles.title}>Preview</h4>
                                <div className="stack">
                                    {/* [Preview content remains the same] */}
                                </div>
                            </div>

                            {/* Form - improved input styling */}
                            <form onSubmit={handleSubmit}>
                                <div className="stack">
                                    <div>
                                        <label className={formStyles.label}>Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={formStyles.input}
                                        />
                                    </div>
                                    <div>
                                        <label className={formStyles.label}>Frequency (MHz)</label>
                                        <input
                                            type="text"
                                            name="frequency"
                                            value={formData.frequency}
                                            onChange={handleInputChange}
                                            className={formStyles.input}
                                        />
                                    </div>
                                    <div className="gridTwo">
                                        <div>
                                            <label className={formStyles.label}>Type</label>
                                            <select
                                                name="type"
                                                value={formData.type}
                                                onChange={handleInputChange}
                                                className={formStyles.select}
                                            >
                                                <option value="NFM">NFM</option>
                                                <option value="FM">FM</option>
                                                <option value="AM">AM</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={formStyles.label}>Tone</label>
                                            <select
                                                name="tone"
                                                value={formData.tone}
                                                onChange={handleInputChange}
                                                className={formStyles.select}
                                            >
                                                <option value="">None</option>
                                                <optgroup label="CTCSS Tones">
                                                    {CTCSS_TONES.map(tone => (
                                                        <option key={tone.freq} value={`CTCSS ${tone.freq}`}>
                                                            CTCSS {tone.freq} Hz ({tone.desc})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="DCS Normal">
                                                    {DCS_CODES.normal.map(code => (
                                                        <option key={code} value={`DCS ${code}`}>
                                                            DCS {code}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={formStyles.label}>Tag</label>
                                        <input
                                            type="text"
                                            name="tag"
                                            value={formData.tag}
                                            onChange={handleInputChange}
                                            className={formStyles.input}
                                        />
                                    </div>
                                    <div>
                                        <label className={formStyles.label}>Person</label>
                                        <input
                                            type="text"
                                            name="person"
                                            value={formData.person}
                                            onChange={handleInputChange}
                                            className={formStyles.input}
                                        />
                                    </div>
                                    <div >
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                                        >
                                            <Save className="iconSmall" />
                                            <span>{modalMode === 'create' ? 'Create' : 'Save Changes'}</span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div>
                            <div className="row">
                                <div className="row">
                                    <AlertTriangle className="iconLarge" />
                                </div>
                                <div>
                                    <h4 className={cardStyles.title}>Confirm Deletion</h4>
                                    <p className="mutedText smallText">
                                        Are you sure you want to delete this frequency? This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <div >
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                                >
                                    <Trash2 className="iconSmall" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    )}
            </div>
        </dialog>
    );

    return (
        <div >
            {/* Header Section */}
            <div className="rowBetween">
                <div className="row">
                    <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                        <RadioTower className="iconLarge" />
                    </div>
                    <div>
                        <h3 className="pageTitle">Stations</h3>
                        <p className="mutedText smallText">
                            Add and manage stations for your recordings
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        openModal('create', null);
                    }}
                    className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                >
                    <Plus className="iconMedium" />
                    <span>Add Station</span>
                </button>
            </div>

            {/* Search and Filter Bar */}
            <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                    <div className="rowBetween">
                        <div className="grow">
                            <Search />
                            <input
                                type="text"
                                placeholder="Search frequencies..."
                                className={formStyles.input}
                            />
                        </div>
                        <button className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.icon}`}>
                            <Filter className="iconMedium" />
                        </button>
                        <button 
                            onClick={fetchFrequencies}
                            className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.icon}`}
                        >
                            <RotateCw className="iconMedium" />
                        </button>
                    </div>
                </div>

            {/* Frequencies Table */}
            <div className={cardStyles.card}>
                {isLoading ? (
                    <div >Loading...</div>
                ) : error ? (
                    <div >{error}</div>
                ) : (
                    <table className={tableStyles.table}>
                        <thead >
                            <tr>
                                <th className={tableStyles.header}>Status</th>
                                <th className={tableStyles.header}>Name/Frequency</th>
                                <th className={tableStyles.header}>Type/Tone</th>
                                <th className={tableStyles.header}>Tag</th>
                                <th className={tableStyles.header}>Person</th>
                                <th className={tableStyles.header}>Actions</th>
                            </tr>
                        </thead>
                        <tbody >
                            {frequencies.map((freq) => (
                                <tr key={freq.id} className={tableStyles.rowInteractive}>
                                    <td className={tableStyles.cell}>
                                        <div  />
                                    </td>
                                    <td className={tableStyles.cell}>
                                        <div >{freq.name}</div>
                                        <div >{freq.frequency} MHz</div>
                                    </td>
                                    <td className={tableStyles.cell}>
                                        <div >{freq.type}</div>
                                        <div >{freq.tone}</div>
                                    </td>
                                    <td className={tableStyles.cell}>
                                        <span className="pill pillSuccess">
                                            {freq.tag}
                                        </span>
                                    </td>
                                    <td className={tableStyles.cell}>{freq.person}</td>
                                    <td className={tableStyles.cell}>
                                        <button
                                            onClick={() => openModal('edit', freq)}
                                            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                                        >
                                            <Edit2 className="iconSmall" />
                                        </button>
                                        <button
                                            onClick={() => openModal('delete', freq)}
                                            className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                                        >
                                            <Trash2 className="iconSmall" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && renderModal()}

            {/* Notification Toast */}
            {showNotification && (
                <div >
                    <div className="row">
                        <div className="row">
                            <Check className="iconMedium" />
                        </div>
                        <p className="mutedText smallText">{notificationMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FrequencyManagement;